# Supabase Configuration for Email/Password Auth

## Important: Disable Email Confirmation

To allow users to sign up without email confirmation, you need to configure your Supabase project:

### Steps:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Providers** > **Email**
3. Find the setting "Confirm email" and **DISABLE** it
4. Save changes

This will allow users to sign up with email and password and be immediately authenticated without having to verify their email.

## Current Auth Setup

- **Method**: Email + Password
- **Email Confirmation**: Disabled (must be configured in Supabase dashboard)
- **User Metadata**: `ingame_name` (optional, can be set during signup in AuthModal)

## Alternative: If you prefer username-only authentication

If you want to completely remove the email requirement and use only usernames, you would need to:

1. Set up custom authentication using database tables
2. Store usernames and hashed passwords directly
3. Handle authentication manually

The current setup (email + password without confirmation) is simpler and uses Supabase's built-in auth system.
