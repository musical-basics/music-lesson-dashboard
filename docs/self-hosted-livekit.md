# Self-hosted LiveKit (classroom calls + recording)

Since November 2026 the classroom can run on our own LiveKit server instead of
LiveKit Cloud. Cloud's free plan allows only 60 recording minutes a month (then
refuses new recordings) and Lionel chose not to pay $50/month for 600, so the
server and the recorder (Egress) run on the Hetzner VPS that already hosts the
24/7 livestream. Recordings are unlimited and cost nothing extra.

## What runs where (on the VPS)

| Piece | How | Notes |
|---|---|---|
| `livekit.service` | Docker `livekit/livekit-server` (pinned), host network | config `/opt/livekit/livekit.yaml`; signal on 127.0.0.1:7880 |
| `livekit-egress.service` | Docker `livekit/egress` (pinned), host network | config `/opt/livekit/egress.yaml`; capped `--cpus 2.5`, low `--cpu-shares`, so the livestream's ffmpeg always wins |
| Redis | apt `redis-server`, 127.0.0.1 only, password | LiveKit and Egress talk through it |
| nginx | existing; adds `rtc.` and `turn.` | see "Port 443" below |

Secrets (API key/secret, Redis password) live only in `/opt/livekit/secrets.env`
(root, 600) and the two YAML files, plus the classroom's Vercel env. Never in git.

Docker is installed with `"iptables": false` so it doesn't rewrite the host
firewall; everything uses host networking.

## Port 443 (why nginx is in front)

Some networks only let TCP 80/443 out (the studio Mac's does: no UDP, no other
ports). LiveKit Cloud gets through those with TURN over TLS on 443, so we must
too. nginx already owns 443 for the livestream dashboard, so its `stream`
module reads the TLS server name and routes:

- `turn.musicalbasics.com` -> nginx terminates TLS -> LiveKit TURN on 127.0.0.1:5349 (`turn.external_tls: true`)
- everything else -> the normal nginx HTTPS sites (now on 127.0.0.1:8443), where
  `rtc.musicalbasics.com` proxies the WebSocket to 127.0.0.1:7880

Clients on open networks use UDP 50000-50200 / TCP 7881 directly; restricted
networks fall back to TURN/TLS on 443 automatically.

## Classroom app settings (Vercel, production)

- `NEXT_PUBLIC_LIVEKIT_URL` = `wss://rtc.musicalbasics.com`
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` = the self-hosted pair
- `LIVEKIT_CLOUD_URL` / `LIVEKIT_CLOUD_API_KEY` / `LIVEKIT_CLOUD_API_SECRET` = the old Cloud values, kept for rollback
- `NEXT_PUBLIC_CLASSROOM_AUTO_RECORD` = unset (on) or `off`

`NEXT_PUBLIC_*` values are baked in at build time: any change needs a redeploy.

**Roll back to LiveKit Cloud, quick (#950, no redeploy):** set
`classroom_settings.livekit_fallback` to `true` (the portal's server-down
emails carry a one-tap link for it, `/api/classroom-switch`). `lib/livekit-target.ts`
then sends new connections, tokens, recordings and Mark to the `LIVEKIT_CLOUD_*`
server within about 30 seconds; the token answer turns auto-record off there;
webhooks from either server are accepted. People already in a lesson reload.
Back: the same link with `to=main` (offered in the "server is back" email), or
set the value to `false`. Needs the three `LIVEKIT_CLOUD_*` values set; without
them the setting does nothing.

**Roll back for good:** copy the three `LIVEKIT_CLOUD_*` values back
into `NEXT_PUBLIC_LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`, set
`NEXT_PUBLIC_CLASSROOM_AUTO_RECORD=off` (Cloud's free minutes run out after
about one lesson), redeploy.

## Recording flow

1. Teacher and a student are in the room -> the teacher's lesson screen starts
   the recording after 4 seconds (auto-record), or the teacher presses Record.
   `/api/recording/egress/start` is idempotent per room.
2. Stop: the teacher's Stop / Leave Lesson / tab-close beacon, or the reaper
   (`lib/egress-reaper.ts`) for forgotten ones.
3. LiveKit posts `egress_ended` to `/api/livekit/webhook` once the MP4 is fully
   in R2. That saves the library row if the browser never did (or fills in the
   real size if it did) and tells the Piano Studio portal to attach it to the
   lesson. One row per file: unique index on `classroom_recordings.url`.

## Piano camera file (#792)

On our server, whenever the lesson recording starts, the teacher's camera (the
piano) is also saved on its own: a Track Egress (`lib/piano-camera.ts`), which
writes the camera's own packets with no re-encoding (about 4% of one core in
the Nov 19 test, against ~40% plus Chrome for the two-camera recording).

- Video only: a track egress takes one track, so there is no sound in it. The
  two-camera recording next to it has the audio.
- Full quality = whatever the camera sends: the top simulcast layer, 1280x720
  at up to 1.7 Mbps (browser VP8 gives `.webm`, H.264 gives `.mp4`). Measured:
  1.43 Mbps, about 10.7 MB a minute (0.32 GB for a 30-minute lesson, 0.64 GB
  for 60); at most ~12.8 MB a minute. It goes to R2 next to the lesson video.
- File `<student>_<lesson start ms>_piano-<ms>.<ext>`; library row with
  `kind = 'piano'` and `lesson_recording_url` = the two-camera video. The
  library shows a "Piano camera" badge and links the two. The portal only uses
  `kind = 'lesson'` rows (attach, auto-log, Dropbox copies).
- Starts with the recording (`/api/recording/egress/start`), or when the
  teacher's camera is published later or again after a reload (the
  `track_published` webhook); stops with it (`/api/recording/egress/stop`), or
  by itself when the teacher leaves; the reaper covers the rest. Its library row
  is saved by the `egress_ended` webhook.
- On only when `NEXT_PUBLIC_LIVEKIT_URL` is not `*.livekit.cloud`
  (`lib/self-hosted.ts`), so it turns on by itself at the switch and off again on
  a rollback. `CLASSROOM_PIANO_CAMERA=off` turns it off on our server too.

## Lessons logged by attendance (#795)

On our server the classroom also records who is in each lesson room, so a
lesson gets logged even when its recording failed:

- LiveKit posts `participant_joined` / `participant_left` /
  `participant_connection_aborted` / `room_finished` to `/api/livekit/webhook`;
  `lib/attendance.ts` keeps one `classroom_attendance` row per connection (room
  `lesson-<student uuid>` only, role teacher or student from the token
  metadata; the recorder and guests are ignored). `room_finished` closes
  anything still open.
- When someone leaves (or the room closes) it calls the portal's
  `/api/webhooks/classroom-attendance` (`PIANO_STUDIO_URL`, `PIANO_STUDIO_SECRET`).
  The portal (`lib/classroom-attendance.ts`) sums the minutes teacher and student
  were in the room together per lesson and, at 20+, logs that lesson the usual
  way, as 'classroom_attendance' ("logged by attendance" in the morning email,
  the weekly summary and the ledger). Same rules as the video auto-log: still
  unlogged, from the last 7 days, matched by the slot that holds the start. One
  log per lesson whichever comes first (`lesson_auto_logs` claim). Nothing is
  decided while someone is still in the room. The portal's 30-minute classroom
  cron sweeps the last 7 days too.
- On only when `NEXT_PUBLIC_LIVEKIT_URL` is not `*.livekit.cloud`;
  `CLASSROOM_ATTENDANCE=off` turns it off. Dry run: POST the portal webhook with
  `{"studentId": "...", "dry": true}`, or the cron with `?dry=1`.

## Upkeep on the server (#949, #951)

- **Health report (#949):** `studio-report.timer` runs `/opt/livekit/studio-report.sh` every 5 minutes. It POSTs `{ livekit, egress, diskPct, diskTotalGb }` (from `systemctl is-active` and `df /`) to the portal's `/api/webhooks/classroom-server-report` with header `x-report-secret` (`STUDIO_REPORT_SECRET` in `/opt/livekit/secrets.env`, the portal's `CLASSROOM_SERVER_REPORT_SECRET`; it can only send this report). The portal's 5-minute `classroom-server-watch` emails once when the recorder or call server stops, when the disk passes 85% (cleared below 80%), or when reports stop for 20 minutes, and once when each is fixed. Recorder and stale alerts only fire once `CLASSROOM_SERVER_HEALTH_URL` is set (the switch); the disk alert always. Check: `systemctl list-timers studio-report.timer`, `journalctl -u studio-report.service -n 5`.
- **Security updates (#951):** unattended-upgrades runs once a week, Sunday 4:00am America/New_York (drop-ins `apt-daily-upgrade.timer.d/studio-sunday.conf`, `apt-daily.timer.d/studio-sunday.conf` at 3:30am), and restarts the server right after only when an update needs it (`/etc/apt/apt.conf.d/52studio-reboot`). livekit, livekit-egress, redis, docker, nginx, streamflow and tailscale all start on boot.

## Checks

- `systemctl status livekit livekit-egress` on the VPS; `docker logs livekit-egress`.
- Egress health: `curl -s 127.0.0.1:7890` on the VPS.
- Livestream unaffected: `top` shows the streamflow ffmpeg at its usual ~1.2 to 1.6 cores during a recording.
