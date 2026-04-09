DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%') LOOP
        EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM %I), 1), false)', 
            r.tablename || '_id_seq', r.tablename);
    END LOOP;
END $$;