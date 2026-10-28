\restrict q8ejeoCyFahu6qJsN0s4eYZVpZNwmAUI3J2CqTlsTz1lSfF2hVKBa0TydjL174W

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ai_interview; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA ai_interview;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: assessment_status; Type: TYPE; Schema: ai_interview; Owner: -
--

CREATE TYPE ai_interview.assessment_status AS ENUM (
    'assessed',
    'insufficient_evidence',
    'not_assessed'
);


--
-- Name: confidence_level; Type: TYPE; Schema: ai_interview; Owner: -
--

CREATE TYPE ai_interview.confidence_level AS ENUM (
    'high',
    'medium',
    'low'
);


--
-- Name: coverage_state; Type: TYPE; Schema: ai_interview; Owner: -
--

CREATE TYPE ai_interview.coverage_state AS ENUM (
    'not_yet',
    'initiated',
    'partial',
    'covered'
);


--
-- Name: end_reason; Type: TYPE; Schema: ai_interview; Owner: -
--

CREATE TYPE ai_interview.end_reason AS ENUM (
    'manual_candidate',
    'manual_assessor',
    'all_covered',
    'time_ceiling',
    'error'
);


--
-- Name: fit_result; Type: TYPE; Schema: ai_interview; Owner: -
--

CREATE TYPE ai_interview.fit_result AS ENUM (
    'match',
    'gap',
    'exceed',
    'not_assessed'
);


--
-- Name: generation_status; Type: TYPE; Schema: ai_interview; Owner: -
--

CREATE TYPE ai_interview.generation_status AS ENUM (
    'pending',
    'generating',
    'complete',
    'failed'
);


--
-- Name: session_status; Type: TYPE; Schema: ai_interview; Owner: -
--

CREATE TYPE ai_interview.session_status AS ENUM (
    'pending',
    'active',
    'ended',
    'failed'
);


--
-- Name: speaker_type; Type: TYPE; Schema: ai_interview; Owner: -
--

CREATE TYPE ai_interview.speaker_type AS ENUM (
    'ai',
    'candidate'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assessment_skills; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.assessment_skills (
    id bigint NOT NULL,
    assessment_id bigint NOT NULL,
    skill_id character varying(50),
    skill_label character varying(255) NOT NULL,
    is_custom boolean DEFAULT false NOT NULL,
    scope_include text,
    scope_exclude text,
    l1_anchor text NOT NULL,
    l2_anchor text NOT NULL,
    l3_anchor text NOT NULL,
    l4_anchor text NOT NULL,
    l5_anchor text NOT NULL,
    expected_level integer,
    display_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT chk_assessment_skills_expected_level CHECK (((expected_level >= 1) AND (expected_level <= 5)))
);


--
-- Name: assessment_skills_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.assessment_skills_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessment_skills_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.assessment_skills_id_seq OWNED BY ai_interview.assessment_skills.id;


--
-- Name: assessments; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.assessments (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    created_by bigint NOT NULL,
    name character varying(255) NOT NULL,
    time_limit_min integer NOT NULL,
    system_prompt text,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    language character varying DEFAULT 'en'::character varying,
    CONSTRAINT chk_assessments_time_limit CHECK ((time_limit_min = ANY (ARRAY[10, 30, 45, 60, 90])))
);


--
-- Name: assessments_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.assessments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessments_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.assessments_id_seq OWNED BY ai_interview.assessments.id;


--
-- Name: assessor_overrides; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.assessor_overrides (
    id bigint NOT NULL,
    portfolio_skill_id bigint NOT NULL,
    ai_level integer NOT NULL,
    override_level integer NOT NULL,
    assessor_notes text,
    overridden_by bigint NOT NULL,
    overridden_at timestamp(6) without time zone DEFAULT now(),
    CONSTRAINT chk_overrides_ai_level CHECK (((ai_level >= 1) AND (ai_level <= 5))),
    CONSTRAINT chk_overrides_override_level CHECK (((override_level >= 1) AND (override_level <= 5)))
);


--
-- Name: assessor_overrides_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.assessor_overrides_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assessor_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.assessor_overrides_id_seq OWNED BY ai_interview.assessor_overrides.id;


--
-- Name: coverage_maps; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.coverage_maps (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    skill_id character varying(50),
    skill_label character varying(255) NOT NULL,
    is_discovered boolean DEFAULT false NOT NULL,
    state ai_interview.coverage_state DEFAULT 'not_yet'::ai_interview.coverage_state NOT NULL,
    probe_count integer DEFAULT 0 NOT NULL,
    last_signal text,
    updated_at timestamp(6) without time zone DEFAULT now()
);


--
-- Name: coverage_maps_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.coverage_maps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coverage_maps_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.coverage_maps_id_seq OWNED BY ai_interview.coverage_maps.id;


--
-- Name: fit_gap_reports; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.fit_gap_reports (
    id bigint NOT NULL,
    portfolio_id bigint NOT NULL,
    vacancy_id bigint NOT NULL,
    skill_comparisons jsonb NOT NULL,
    culture_narrative text,
    overall_narrative text,
    generated_at timestamp(6) without time zone DEFAULT now()
);


--
-- Name: fit_gap_reports_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.fit_gap_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fit_gap_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.fit_gap_reports_id_seq OWNED BY ai_interview.fit_gap_reports.id;


--
-- Name: portfolio_skills; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.portfolio_skills (
    id bigint NOT NULL,
    portfolio_id bigint NOT NULL,
    skill_id character varying(50),
    skill_label character varying(255) NOT NULL,
    is_discovered boolean DEFAULT false NOT NULL,
    ai_level integer,
    ai_confidence ai_interview.confidence_level NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    competency_summary text NOT NULL,
    assessment_status ai_interview.assessment_status NOT NULL,
    CONSTRAINT chk_portfolio_skills_ai_level CHECK (((ai_level >= 1) AND (ai_level <= 5))),
    CONSTRAINT chk_portfolio_skills_status_level_consistency CHECK ((((assessment_status <> 'not_assessed'::ai_interview.assessment_status) OR (ai_level IS NULL)) AND ((assessment_status <> 'assessed'::ai_interview.assessment_status) OR (ai_level IS NOT NULL))))
);


--
-- Name: portfolio_skills_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.portfolio_skills_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portfolio_skills_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.portfolio_skills_id_seq OWNED BY ai_interview.portfolio_skills.id;


--
-- Name: portfolios; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.portfolios (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    candidate_id bigint,
    generation_status ai_interview.generation_status DEFAULT 'pending'::ai_interview.generation_status NOT NULL,
    generated_at timestamp(6) without time zone,
    generation_error text
);


--
-- Name: portfolios_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.portfolios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: portfolios_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.portfolios_id_seq OWNED BY ai_interview.portfolios.id;


--
-- Name: sessions; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.sessions (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    assessment_id bigint NOT NULL,
    candidate_id bigint,
    invite_token character varying(64) NOT NULL,
    status ai_interview.session_status DEFAULT 'pending'::ai_interview.session_status NOT NULL,
    end_reason ai_interview.end_reason,
    started_at timestamp(6) without time zone,
    ended_at timestamp(6) without time zone,
    duration_seconds integer,
    gemini_resumption_token text,
    created_at timestamp(6) without time zone DEFAULT now() NOT NULL,
    candidate_name character varying(255)
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.sessions_id_seq OWNED BY ai_interview.sessions.id;


--
-- Name: skill_taxonomies; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.skill_taxonomies (
    id bigint NOT NULL,
    skill_id character varying(50) NOT NULL,
    skill_label character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    scope_include text,
    scope_exclude text,
    l1_anchor text NOT NULL,
    l2_anchor text NOT NULL,
    l3_anchor text NOT NULL,
    l4_anchor text NOT NULL,
    l5_anchor text NOT NULL
);


--
-- Name: skill_taxonomies_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.skill_taxonomies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: skill_taxonomies_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.skill_taxonomies_id_seq OWNED BY ai_interview.skill_taxonomies.id;


--
-- Name: transcript_turns; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.transcript_turns (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    turn_number integer NOT NULL,
    speaker ai_interview.speaker_type NOT NULL,
    text text NOT NULL,
    audio_start_ms integer,
    audio_end_ms integer,
    created_at timestamp(6) without time zone DEFAULT now() NOT NULL
);


--
-- Name: transcript_turns_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.transcript_turns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transcript_turns_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.transcript_turns_id_seq OWNED BY ai_interview.transcript_turns.id;


--
-- Name: users; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.users (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    password_digest character varying NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.users_id_seq OWNED BY ai_interview.users.id;


--
-- Name: vacancies; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.vacancies (
    id bigint NOT NULL,
    tenant_id bigint NOT NULL,
    created_by bigint NOT NULL,
    role_title character varying(255) NOT NULL,
    culture_dimensions text,
    competency_expectations text,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: vacancies_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.vacancies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vacancies_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.vacancies_id_seq OWNED BY ai_interview.vacancies.id;


--
-- Name: vacancy_skills; Type: TABLE; Schema: ai_interview; Owner: -
--

CREATE TABLE ai_interview.vacancy_skills (
    id bigint NOT NULL,
    vacancy_id bigint NOT NULL,
    skill_id character varying(50),
    skill_label character varying(255) NOT NULL,
    expected_level integer NOT NULL,
    CONSTRAINT chk_vacancy_skills_expected_level CHECK (((expected_level >= 1) AND (expected_level <= 5)))
);


--
-- Name: vacancy_skills_id_seq; Type: SEQUENCE; Schema: ai_interview; Owner: -
--

CREATE SEQUENCE ai_interview.vacancy_skills_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vacancy_skills_id_seq; Type: SEQUENCE OWNED BY; Schema: ai_interview; Owner: -
--

ALTER SEQUENCE ai_interview.vacancy_skills_id_seq OWNED BY ai_interview.vacancy_skills.id;


--
-- Name: ar_internal_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_internal_metadata (
    key character varying NOT NULL,
    value character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    scheme character varying(255) NOT NULL,
    identifier character varying(255) NOT NULL,
    host character varying(255) NOT NULL,
    alias_hosts character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: assessment_skills id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.assessment_skills ALTER COLUMN id SET DEFAULT nextval('ai_interview.assessment_skills_id_seq'::regclass);


--
-- Name: assessments id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.assessments ALTER COLUMN id SET DEFAULT nextval('ai_interview.assessments_id_seq'::regclass);


--
-- Name: assessor_overrides id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.assessor_overrides ALTER COLUMN id SET DEFAULT nextval('ai_interview.assessor_overrides_id_seq'::regclass);


--
-- Name: coverage_maps id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.coverage_maps ALTER COLUMN id SET DEFAULT nextval('ai_interview.coverage_maps_id_seq'::regclass);


--
-- Name: fit_gap_reports id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.fit_gap_reports ALTER COLUMN id SET DEFAULT nextval('ai_interview.fit_gap_reports_id_seq'::regclass);


--
-- Name: portfolio_skills id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.portfolio_skills ALTER COLUMN id SET DEFAULT nextval('ai_interview.portfolio_skills_id_seq'::regclass);


--
-- Name: portfolios id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.portfolios ALTER COLUMN id SET DEFAULT nextval('ai_interview.portfolios_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.sessions ALTER COLUMN id SET DEFAULT nextval('ai_interview.sessions_id_seq'::regclass);


--
-- Name: skill_taxonomies id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.skill_taxonomies ALTER COLUMN id SET DEFAULT nextval('ai_interview.skill_taxonomies_id_seq'::regclass);


--
-- Name: transcript_turns id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.transcript_turns ALTER COLUMN id SET DEFAULT nextval('ai_interview.transcript_turns_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.users ALTER COLUMN id SET DEFAULT nextval('ai_interview.users_id_seq'::regclass);


--
-- Name: vacancies id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.vacancies ALTER COLUMN id SET DEFAULT nextval('ai_interview.vacancies_id_seq'::regclass);


--
-- Name: vacancy_skills id; Type: DEFAULT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.vacancy_skills ALTER COLUMN id SET DEFAULT nextval('ai_interview.vacancy_skills_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: assessment_skills assessment_skills_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.assessment_skills
    ADD CONSTRAINT assessment_skills_pkey PRIMARY KEY (id);


--
-- Name: assessments assessments_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.assessments
    ADD CONSTRAINT assessments_pkey PRIMARY KEY (id);


--
-- Name: assessor_overrides assessor_overrides_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.assessor_overrides
    ADD CONSTRAINT assessor_overrides_pkey PRIMARY KEY (id);


--
-- Name: coverage_maps coverage_maps_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.coverage_maps
    ADD CONSTRAINT coverage_maps_pkey PRIMARY KEY (id);


--
-- Name: fit_gap_reports fit_gap_reports_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.fit_gap_reports
    ADD CONSTRAINT fit_gap_reports_pkey PRIMARY KEY (id);


--
-- Name: portfolio_skills portfolio_skills_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.portfolio_skills
    ADD CONSTRAINT portfolio_skills_pkey PRIMARY KEY (id);


--
-- Name: portfolios portfolios_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.portfolios
    ADD CONSTRAINT portfolios_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: skill_taxonomies skill_taxonomies_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.skill_taxonomies
    ADD CONSTRAINT skill_taxonomies_pkey PRIMARY KEY (id);


--
-- Name: transcript_turns transcript_turns_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.transcript_turns
    ADD CONSTRAINT transcript_turns_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vacancies vacancies_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.vacancies
    ADD CONSTRAINT vacancies_pkey PRIMARY KEY (id);


--
-- Name: vacancy_skills vacancy_skills_pkey; Type: CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.vacancy_skills
    ADD CONSTRAINT vacancy_skills_pkey PRIMARY KEY (id);


--
-- Name: ar_internal_metadata ar_internal_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_internal_metadata
    ADD CONSTRAINT ar_internal_metadata_pkey PRIMARY KEY (key);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: idx_ai_interview_users_email; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE UNIQUE INDEX idx_ai_interview_users_email ON ai_interview.users USING btree (email);


--
-- Name: idx_coverage_session; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX idx_coverage_session ON ai_interview.coverage_maps USING btree (session_id);


--
-- Name: idx_sessions_invite_token; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE UNIQUE INDEX idx_sessions_invite_token ON ai_interview.sessions USING btree (invite_token);


--
-- Name: idx_sessions_tenant_status; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX idx_sessions_tenant_status ON ai_interview.sessions USING btree (tenant_id, status);


--
-- Name: idx_skill_taxonomies_category; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX idx_skill_taxonomies_category ON ai_interview.skill_taxonomies USING btree (category);


--
-- Name: idx_skill_taxonomies_skill_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE UNIQUE INDEX idx_skill_taxonomies_skill_id ON ai_interview.skill_taxonomies USING btree (skill_id);


--
-- Name: idx_transcript_session; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE UNIQUE INDEX idx_transcript_session ON ai_interview.transcript_turns USING btree (session_id, turn_number);


--
-- Name: index_assessment_skills_on_assessment_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_assessment_skills_on_assessment_id ON ai_interview.assessment_skills USING btree (assessment_id);


--
-- Name: index_assessments_on_tenant_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_assessments_on_tenant_id ON ai_interview.assessments USING btree (tenant_id);


--
-- Name: index_assessor_overrides_on_portfolio_skill_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE UNIQUE INDEX index_assessor_overrides_on_portfolio_skill_id ON ai_interview.assessor_overrides USING btree (portfolio_skill_id);


--
-- Name: index_coverage_maps_on_session_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_coverage_maps_on_session_id ON ai_interview.coverage_maps USING btree (session_id);


--
-- Name: index_coverage_maps_on_session_id_and_skill_label; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE UNIQUE INDEX index_coverage_maps_on_session_id_and_skill_label ON ai_interview.coverage_maps USING btree (session_id, skill_label);


--
-- Name: index_fit_gap_reports_on_portfolio_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_fit_gap_reports_on_portfolio_id ON ai_interview.fit_gap_reports USING btree (portfolio_id);


--
-- Name: index_fit_gap_reports_on_portfolio_id_and_vacancy_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE UNIQUE INDEX index_fit_gap_reports_on_portfolio_id_and_vacancy_id ON ai_interview.fit_gap_reports USING btree (portfolio_id, vacancy_id);


--
-- Name: index_fit_gap_reports_on_vacancy_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_fit_gap_reports_on_vacancy_id ON ai_interview.fit_gap_reports USING btree (vacancy_id);


--
-- Name: index_portfolio_skills_on_portfolio_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_portfolio_skills_on_portfolio_id ON ai_interview.portfolio_skills USING btree (portfolio_id);


--
-- Name: index_portfolios_on_candidate_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_portfolios_on_candidate_id ON ai_interview.portfolios USING btree (candidate_id);


--
-- Name: index_portfolios_on_session_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE UNIQUE INDEX index_portfolios_on_session_id ON ai_interview.portfolios USING btree (session_id);


--
-- Name: index_sessions_on_assessment_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_sessions_on_assessment_id ON ai_interview.sessions USING btree (assessment_id);


--
-- Name: index_sessions_on_candidate_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_sessions_on_candidate_id ON ai_interview.sessions USING btree (candidate_id);


--
-- Name: index_transcript_turns_on_session_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_transcript_turns_on_session_id ON ai_interview.transcript_turns USING btree (session_id);


--
-- Name: index_vacancies_on_tenant_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_vacancies_on_tenant_id ON ai_interview.vacancies USING btree (tenant_id);


--
-- Name: index_vacancy_skills_on_vacancy_id; Type: INDEX; Schema: ai_interview; Owner: -
--

CREATE INDEX index_vacancy_skills_on_vacancy_id ON ai_interview.vacancy_skills USING btree (vacancy_id);


--
-- Name: index_organizations_on_host; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_organizations_on_host ON public.organizations USING btree (host);


--
-- Name: index_organizations_on_scheme; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_organizations_on_scheme ON public.organizations USING btree (scheme);


--
-- Name: transcript_turns fk_rails_2dcb653773; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.transcript_turns
    ADD CONSTRAINT fk_rails_2dcb653773 FOREIGN KEY (session_id) REFERENCES ai_interview.sessions(id);


--
-- Name: assessment_skills fk_rails_45bceec491; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.assessment_skills
    ADD CONSTRAINT fk_rails_45bceec491 FOREIGN KEY (assessment_id) REFERENCES ai_interview.assessments(id);


--
-- Name: portfolios fk_rails_6a6221cc0a; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.portfolios
    ADD CONSTRAINT fk_rails_6a6221cc0a FOREIGN KEY (session_id) REFERENCES ai_interview.sessions(id);


--
-- Name: vacancy_skills fk_rails_95115605ff; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.vacancy_skills
    ADD CONSTRAINT fk_rails_95115605ff FOREIGN KEY (vacancy_id) REFERENCES ai_interview.vacancies(id);


--
-- Name: fit_gap_reports fk_rails_c5804118f9; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.fit_gap_reports
    ADD CONSTRAINT fk_rails_c5804118f9 FOREIGN KEY (vacancy_id) REFERENCES ai_interview.vacancies(id);


--
-- Name: portfolio_skills fk_rails_d331c1fe60; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.portfolio_skills
    ADD CONSTRAINT fk_rails_d331c1fe60 FOREIGN KEY (portfolio_id) REFERENCES ai_interview.portfolios(id);


--
-- Name: coverage_maps fk_rails_ddc60ec6e3; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.coverage_maps
    ADD CONSTRAINT fk_rails_ddc60ec6e3 FOREIGN KEY (session_id) REFERENCES ai_interview.sessions(id);


--
-- Name: assessor_overrides fk_rails_ea51a59102; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.assessor_overrides
    ADD CONSTRAINT fk_rails_ea51a59102 FOREIGN KEY (portfolio_skill_id) REFERENCES ai_interview.portfolio_skills(id);


--
-- Name: sessions fk_rails_f58c290ff1; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.sessions
    ADD CONSTRAINT fk_rails_f58c290ff1 FOREIGN KEY (assessment_id) REFERENCES ai_interview.assessments(id);


--
-- Name: fit_gap_reports fk_rails_f6c6ca9643; Type: FK CONSTRAINT; Schema: ai_interview; Owner: -
--

ALTER TABLE ONLY ai_interview.fit_gap_reports
    ADD CONSTRAINT fk_rails_f6c6ca9643 FOREIGN KEY (portfolio_id) REFERENCES ai_interview.portfolios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict q8ejeoCyFahu6qJsN0s4eYZVpZNwmAUI3J2CqTlsTz1lSfF2hVKBa0TydjL174W

SET search_path TO ai_interview,public;

INSERT INTO "schema_migrations" (version) VALUES
('20231201000000'),
('20240101000000'),
('20260320000000'),
('20260320000001'),
('20260323032702'),
('20260411000000'),
('20260505000000'),
('20260505000001'),
('20260505000002'),
('20261024063750');


