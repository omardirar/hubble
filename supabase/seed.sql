SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict QvWnDi6oeJTBKcd7LkfZ5mxCkOJUq9XfDLZZA1l84LxSxMz3jiPDZdWz2GeoUII

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

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
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: connector_types; Type: TABLE DATA; Schema: connect; Owner: postgres
--



--
-- Data for Name: organizations; Type: TABLE DATA; Schema: core; Owner: postgres
--



--
-- Data for Name: data_connections; Type: TABLE DATA; Schema: connect; Owner: postgres
--



--
-- Data for Name: data_destinations; Type: TABLE DATA; Schema: connect; Owner: postgres
--



--
-- Data for Name: organization_quotas; Type: TABLE DATA; Schema: core; Owner: postgres
--



--
-- Data for Name: provisioning_workflows; Type: TABLE DATA; Schema: core; Owner: postgres
--



--
-- Data for Name: account; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: audit_trail; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: column_lineage; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: connection; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: connector_type; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: destination; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: destination_column; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: destination_column_change_event; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: destination_schema; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: destination_schema_change_event; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: destination_table; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: destination_table_change_event; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: incremental_mar; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: log; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: resource_membership; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: role; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: role_permission; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: schema_lineage; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: source_column; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: source_column_change_event; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: source_schema; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: source_schema_change_event; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: source_table; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: source_table_change_event; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: table_lineage; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: user; Type: TABLE DATA; Schema: fivetran_log; Owner: postgres
--



--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: agent_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_namespaces; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_tables; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--



--
-- Data for Name: audit_events; Type: TABLE DATA; Schema: system; Owner: postgres
--



--
-- Data for Name: idempotency_keys; Type: TABLE DATA; Schema: system; Owner: postgres
--



--
-- Data for Name: rate_limits; Type: TABLE DATA; Schema: system; Owner: postgres
--



--
-- Data for Name: secrets; Type: TABLE DATA; Schema: system; Owner: postgres
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1, false);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- Name: audit_events_id_seq; Type: SEQUENCE SET; Schema: system; Owner: postgres
--

SELECT pg_catalog.setval('"system"."audit_events_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict QvWnDi6oeJTBKcd7LkfZ5mxCkOJUq9XfDLZZA1l84LxSxMz3jiPDZdWz2GeoUII

RESET ALL;
