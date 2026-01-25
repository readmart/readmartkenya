
-- ==========================================
-- Migration: Fix Site Settings and Profile Roles
-- Description: Adds missing foreign key and ensures 'author' role exists in enum
-- ==========================================

-- 1. Ensure 'author' and 'partner' roles exist in user_role ENUM
-- Note: ALTER TYPE ... ADD VALUE cannot be run in a transaction block
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        -- We use a separate block for each to handle potential "already exists" errors if ADD VALUE IF NOT EXISTS isn't supported
        BEGIN
            ALTER TYPE public.user_role ADD VALUE 'author';
        EXCEPTION WHEN duplicate_object THEN 
            RAISE NOTICE 'Role author already exists in user_role';
        END;
        
        BEGIN
            ALTER TYPE public.user_role ADD VALUE 'partner';
        EXCEPTION WHEN duplicate_object THEN 
            RAISE NOTICE 'Role partner already exists in user_role';
        END;
    END IF;
END $$;

-- 2. Ensure the column exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_id') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_id uuid;
    END IF;
END $$;

-- 3. Add the foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
          AND tc.table_name = 'site_settings' 
          AND kcu.column_name = 'author_of_the_day_id'
          AND tc.constraint_type = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE public.site_settings 
        ADD CONSTRAINT site_settings_author_of_the_day_id_fkey 
        FOREIGN KEY (author_of_the_day_id) 
        REFERENCES public.profiles(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';
