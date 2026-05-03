CREATE POLICY "deny_client_access" ON "User"
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_client_access" ON "Session"
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_client_access" ON "LoginAttempt"
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_client_access" ON "DailyUsage"
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_client_access" ON "Generation"
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_client_access" ON "AppSetting"
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
