--
-- PostgreSQL database dump
--

\restrict KFYUFgBgmWFYAxxzLdDzN2UztkRP4g6a6NrXHWkmvVrz6ggRqb7fGf7UqtDyAH2

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: assign_managers_to_new_greenhouse(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_managers_to_new_greenhouse() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.greenhouse_users (greenhouse_id, user_id, role)
  select
    new.id,
    p.id,
    'owner'
  from public.profiles p
  where p.system_role in ('admin', 'owner')
  on conflict (greenhouse_id, user_id)
  do update set role = 'owner';

  return new;
end;
$$;


--
-- Name: handle_new_notification_settings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_notification_settings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.notification_settings (
    user_id,
    enabled,
    recipient_email,
    notify_offline,
    notify_frost,
    notify_critical
  )
  values (
    new.id,
    false,
    new.email,
    true,
    true,
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, email, system_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    case
      when lower(new.email) = 'bootstrap-admin@example.invalid' then 'admin'
      when lower(new.email) = 'bootstrap-owner@example.invalid' then 'owner'
      else 'viewer'
    end
  )
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    email = excluded.email;

  return new;
end;
$$;


--
-- Name: is_system_manager(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_system_manager() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.system_role in ('admin','owner')
  );
$$;


--
-- Name: set_notification_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_notification_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alert_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_states (
    source_type text NOT NULL,
    source_id bigint NOT NULL,
    alert_type text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    activated_at timestamp with time zone,
    resolved_at timestamp with time zone,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alert_states_alert_type_check CHECK ((alert_type = ANY (ARRAY['offline'::text, 'frost'::text, 'critical'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    actor_user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    greenhouse_id bigint,
    old_value jsonb,
    new_value jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    greenhouse_id bigint NOT NULL,
    name text NOT NULL,
    secret_hash text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    firmware_version text,
    last_seen timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_notification_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_notification_log (
    id bigint NOT NULL,
    user_id uuid,
    greenhouse_id bigint,
    warning_key text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    provider_message_id text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT email_notification_log_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'suppressed'::text])))
);


--
-- Name: email_notification_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.email_notification_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.email_notification_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: greenhouse_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.greenhouse_users (
    greenhouse_id bigint NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT greenhouse_users_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'operator'::text, 'viewer'::text])))
);


--
-- Name: greenhouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.greenhouses (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    roof_temperature_open double precision,
    roof_temperature_close double precision,
    auto_mode boolean,
    roof_window_open boolean,
    wall_window_open boolean,
    watering_on boolean,
    status text,
    wall_temperature_open double precision,
    wall_temperature_close double precision,
    roof_window_target boolean,
    wall_window_target boolean,
    watering_target boolean,
    warning_active boolean,
    warning_message text,
    warning_since timestamp with time zone,
    warning_priority text,
    temperature double precision,
    humidity double precision,
    roof_open_sensor boolean,
    roof_closed_sensor boolean,
    wall_open_sensor boolean,
    wall_closed_sensor boolean,
    last_seen timestamp with time zone,
    roof_manual_override boolean,
    wall_manual_override boolean,
    watering_manual_override boolean,
    monitoring_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: greenhouses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.greenhouses ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.greenhouses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: manual_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_commands (
    id bigint NOT NULL,
    greenhouse_id bigint,
    roof_window_command boolean,
    wall_window_command boolean,
    watering_command boolean,
    auto_mode boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: manual_commands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.manual_commands ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.manual_commands_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_settings (
    user_id uuid NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    recipient_email text,
    notify_offline boolean DEFAULT true NOT NULL,
    notify_frost boolean DEFAULT true NOT NULL,
    notify_critical boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_address text,
    email_enabled boolean DEFAULT false NOT NULL,
    offline_alerts boolean DEFAULT true NOT NULL,
    frost_alerts boolean DEFAULT true NOT NULL,
    critical_alerts boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    system_role text DEFAULT 'viewer'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    mfa_required boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_system_role_check CHECK ((system_role = ANY (ARRAY['admin'::text, 'owner'::text, 'operator'::text, 'viewer'::text])))
);


--
-- Name: sensor_readings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sensor_readings (
    id bigint NOT NULL,
    greenhouse_id bigint NOT NULL,
    temperature double precision,
    roof_window_open boolean,
    wall_window_open boolean,
    watering_on boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sensor_readings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sensor_readings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sensor_readings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: warning_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warning_logs (
    id bigint NOT NULL,
    greenhouse_id bigint,
    message text,
    priority text,
    type text,
    active boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: warning_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.warning_logs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.warning_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: watering_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watering_schedule (
    id bigint NOT NULL,
    greenhouse_id bigint,
    start_time time without time zone,
    duration_minutes bigint,
    enabled boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: watering_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.watering_schedule ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.watering_schedule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: weather_station; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weather_station (
    id bigint NOT NULL,
    rain boolean,
    wind_speed double precision,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    temperature double precision,
    humidity double precision,
    last_seen timestamp with time zone,
    wind_gust double precision,
    pressure double precision,
    wind_direction double precision,
    status text DEFAULT 'offline'::text
);


--
-- Name: weather_station_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.weather_station ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.weather_station_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: alert_states alert_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_states
    ADD CONSTRAINT alert_states_pkey PRIMARY KEY (source_type, source_id, alert_type);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: devices devices_greenhouse_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_greenhouse_id_name_key UNIQUE (greenhouse_id, name);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: email_notification_log email_notification_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notification_log
    ADD CONSTRAINT email_notification_log_pkey PRIMARY KEY (id);


--
-- Name: greenhouse_users greenhouse_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.greenhouse_users
    ADD CONSTRAINT greenhouse_users_pkey PRIMARY KEY (greenhouse_id, user_id);


--
-- Name: greenhouses greenhouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.greenhouses
    ADD CONSTRAINT greenhouses_pkey PRIMARY KEY (id);


--
-- Name: manual_commands manual_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_commands
    ADD CONSTRAINT manual_commands_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: sensor_readings sensor_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_pkey PRIMARY KEY (id);


--
-- Name: warning_logs warning_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warning_logs
    ADD CONSTRAINT warning_logs_pkey PRIMARY KEY (id);


--
-- Name: watering_schedule watering_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watering_schedule
    ADD CONSTRAINT watering_schedule_pkey PRIMARY KEY (id);


--
-- Name: weather_station weather_station_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_station
    ADD CONSTRAINT weather_station_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);


--
-- Name: devices_greenhouse_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devices_greenhouse_id_idx ON public.devices USING btree (greenhouse_id);


--
-- Name: greenhouses assign_managers_after_greenhouse_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER assign_managers_after_greenhouse_insert AFTER INSERT ON public.greenhouses FOR EACH ROW EXECUTE FUNCTION public.assign_managers_to_new_greenhouse();


--
-- Name: notification_settings notification_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER notification_settings_set_updated_at BEFORE UPDATE ON public.notification_settings FOR EACH ROW EXECUTE FUNCTION public.set_notification_settings_updated_at();


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_greenhouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_greenhouse_id_fkey FOREIGN KEY (greenhouse_id) REFERENCES public.greenhouses(id) ON DELETE SET NULL;


--
-- Name: devices devices_greenhouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_greenhouse_id_fkey FOREIGN KEY (greenhouse_id) REFERENCES public.greenhouses(id) ON DELETE CASCADE;


--
-- Name: email_notification_log email_notification_log_greenhouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notification_log
    ADD CONSTRAINT email_notification_log_greenhouse_id_fkey FOREIGN KEY (greenhouse_id) REFERENCES public.greenhouses(id) ON DELETE CASCADE;


--
-- Name: email_notification_log email_notification_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notification_log
    ADD CONSTRAINT email_notification_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: greenhouse_users greenhouse_users_greenhouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.greenhouse_users
    ADD CONSTRAINT greenhouse_users_greenhouse_id_fkey FOREIGN KEY (greenhouse_id) REFERENCES public.greenhouses(id) ON DELETE CASCADE;


--
-- Name: greenhouse_users greenhouse_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.greenhouse_users
    ADD CONSTRAINT greenhouse_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notification_settings notification_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sensor_readings sensor_readings_greenhouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_greenhouse_id_fkey FOREIGN KEY (greenhouse_id) REFERENCES public.greenhouses(id) ON DELETE CASCADE;


--
-- Name: alert_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.alert_states ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: weather_station authenticated read weather; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated read weather" ON public.weather_station FOR SELECT TO authenticated USING (true);


--
-- Name: devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

--
-- Name: email_notification_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_notification_log ENABLE ROW LEVEL SECURITY;

--
-- Name: greenhouse_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.greenhouse_users ENABLE ROW LEVEL SECURITY;

--
-- Name: greenhouses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.greenhouses ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_settings managers delete all notification settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers delete all notification settings" ON public.notification_settings FOR DELETE TO authenticated USING (public.is_system_manager());


--
-- Name: notification_settings managers insert all notification settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers insert all notification settings" ON public.notification_settings FOR INSERT TO authenticated WITH CHECK (public.is_system_manager());


--
-- Name: alert_states managers read alert states; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers read alert states" ON public.alert_states FOR SELECT TO authenticated USING (public.is_system_manager());


--
-- Name: notification_settings managers read all notification settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers read all notification settings" ON public.notification_settings FOR SELECT TO authenticated USING (public.is_system_manager());


--
-- Name: profiles managers read all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_system_manager());


--
-- Name: audit_logs managers read audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.system_role = ANY (ARRAY['admin'::text, 'owner'::text])) AND p.is_active))));


--
-- Name: devices managers read devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers read devices" ON public.devices FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.system_role = ANY (ARRAY['admin'::text, 'owner'::text])) AND p.is_active))));


--
-- Name: email_notification_log managers read email log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers read email log" ON public.email_notification_log FOR SELECT TO authenticated USING (public.is_system_manager());


--
-- Name: notification_settings managers update all notification settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers update all notification settings" ON public.notification_settings FOR UPDATE TO authenticated USING (public.is_system_manager()) WITH CHECK (public.is_system_manager());


--
-- Name: profiles managers update profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "managers update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_system_manager()) WITH CHECK (public.is_system_manager());


--
-- Name: greenhouses members read greenhouses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read greenhouses" ON public.greenhouses FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = greenhouses.id) AND (gu.user_id = auth.uid())))));


--
-- Name: watering_schedule members read schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read schedules" ON public.watering_schedule FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = watering_schedule.greenhouse_id) AND (gu.user_id = auth.uid())))));


--
-- Name: sensor_readings members read sensor history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read sensor history" ON public.sensor_readings FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = sensor_readings.greenhouse_id) AND (gu.user_id = auth.uid())))));


--
-- Name: warning_logs members read warnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "members read warnings" ON public.warning_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = warning_logs.greenhouse_id) AND (gu.user_id = auth.uid())))));


--
-- Name: notification_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: watering_schedule operators manage schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "operators manage schedules" ON public.watering_schedule TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = watering_schedule.greenhouse_id) AND (gu.user_id = auth.uid()) AND (gu.role = ANY (ARRAY['owner'::text, 'operator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = watering_schedule.greenhouse_id) AND (gu.user_id = auth.uid()) AND (gu.role = ANY (ARRAY['owner'::text, 'operator'::text]))))));


--
-- Name: warning_logs operators manage warnings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "operators manage warnings" ON public.warning_logs TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = warning_logs.greenhouse_id) AND (gu.user_id = auth.uid()) AND (gu.role = ANY (ARRAY['owner'::text, 'operator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = warning_logs.greenhouse_id) AND (gu.user_id = auth.uid()) AND (gu.role = ANY (ARRAY['owner'::text, 'operator'::text]))))));


--
-- Name: greenhouses operators update greenhouses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "operators update greenhouses" ON public.greenhouses FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = greenhouses.id) AND (gu.user_id = auth.uid()) AND (gu.role = ANY (ARRAY['owner'::text, 'operator'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.greenhouse_users gu
  WHERE ((gu.greenhouse_id = greenhouses.id) AND (gu.user_id = auth.uid()) AND (gu.role = ANY (ARRAY['owner'::text, 'operator'::text]))))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: sensor_readings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_settings users delete own notification settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users delete own notification settings" ON public.notification_settings FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notification_settings users insert own notification settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert own notification settings" ON public.notification_settings FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: email_notification_log users read own email log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own email log" ON public.email_notification_log FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: greenhouse_users users read own memberships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own memberships" ON public.greenhouse_users FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notification_settings users read own notification settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own notification settings" ON public.notification_settings FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles users read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: notification_settings users update own notification settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own notification settings" ON public.notification_settings FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: warning_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warning_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: watering_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.watering_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: weather_station; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weather_station ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict KFYUFgBgmWFYAxxzLdDzN2UztkRP4g6a6NrXHWkmvVrz6ggRqb7fGf7UqtDyAH2

