import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
    try {
        // Validate LiveKit credentials exist
        if (!apiKey || !apiSecret) {
            return NextResponse.json(
                { error: 'LiveKit API credentials not configured' },
                { status: 500 }
            );
        }

        // Get the authorization header (Supabase JWT token)
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid authorization header' },
                { status: 401 }
            );
        }

        const token = authHeader.replace('Bearer ', '');

        // Create Supabase client with service role for admin operations
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Verify the user's JWT and get their info
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { appointmentId, roomName } = body;

        if (!appointmentId && !roomName) {
            return NextResponse.json(
                { error: 'appointmentId or roomName is required' },
                { status: 400 }
            );
        }

        // Get the user's profile to check their role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { error: 'User profile not found' },
                { status: 404 }
            );
        }

        const isTeacher = profile.role === 'teacher';

        // If appointmentId is provided, verify the user is a participant
        if (appointmentId) {
            // Build the query based on role
            let appointmentQuery = supabase
                .from('appointments')
                .select('id, room_name, teacher_id, student_id, starts_at, is_paid')
                .eq('id', appointmentId);

            // Students can only access their own appointments
            // Teachers can access all appointments (already handled by RLS)
            if (!isTeacher) {
                appointmentQuery = appointmentQuery.eq('student_id', user.id);
            }

            const { data: appointment, error: appointmentError } = await appointmentQuery.single();

            if (appointmentError || !appointment) {
                return NextResponse.json(
                    { error: 'Appointment not found or access denied' },
                    { status: 403 }
                );
            }

            // Check if the appointment is paid (optional: can be disabled for testing)
            if (!appointment.is_paid && !isTeacher) {
                return NextResponse.json(
                    { error: 'Appointment is not paid' },
                    { status: 402 } // Payment Required
                );
            }

            // Use the room name from the appointment, or generate one
            const finalRoomName = appointment.room_name || `lesson-${appointmentId}`;

            // Generate the LiveKit access token
            const at = new AccessToken(apiKey, apiSecret, {
                identity: user.email || user.id,
                name: user.email || 'User',
                ttl: '2h', // Token valid for 2 hours
            });

            at.addGrant({
                roomJoin: true,
                room: finalRoomName,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true, // Needed for "Mute All" signals
                roomAdmin: isTeacher, // Only teachers get admin powers
            });

            return NextResponse.json({
                token: await at.toJwt(),
                roomName: finalRoomName,
                isTeacher,
            });
        }

        // If only roomName is provided (for direct room access - teachers only)
        if (roomName) {
            if (!isTeacher) {
                return NextResponse.json(
                    { error: 'Only teachers can join rooms directly' },
                    { status: 403 }
                );
            }

            const at = new AccessToken(apiKey, apiSecret, {
                identity: user.email || user.id,
                name: user.email || 'Teacher',
                ttl: '2h',
            });

            at.addGrant({
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
                roomAdmin: true,
            });

            return NextResponse.json({
                token: await at.toJwt(),
                roomName,
                isTeacher: true,
            });
        }

        return NextResponse.json(
            { error: 'Invalid request' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Error generating token:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
