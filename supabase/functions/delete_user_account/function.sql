-- In your SQL function, use a parameter for project_id
CREATE OR REPLACE FUNCTION public.delete_user_account(
    user_id uuid,
    project_id text default current_setting('app.project_id')
)
RETURNS void AS $$
BEGIN
    DELETE FROM user_data
    WHERE user_id = delete_user_account.user_id
    AND project_id = delete_user_account.project_id;
END;
$$ LANGUAGE plpgsql;

-- Set the project_id in your application config or environment
