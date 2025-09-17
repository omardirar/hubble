create extension if not exists wrappers
with
  schema extensions;

create foreign data wrapper wasm_wrapper handler wasm_fdw_handler validator wasm_fdw_validator;

create server clerk_server foreign data wrapper wasm_wrapper options (
  fdw_package_url 'https://github.com/supabase/wrappers/releases/download/wasm_clerk_fdw_v0.2.0/clerk_fdw.wasm',
  fdw_package_name 'supabase:clerk-fdw',
  fdw_package_version '0.2.0',
  fdw_package_checksum '89337bb11779d4d654cd3e54391aabd02509d213db6995f7dd58951774bf0e37',
  api_url 'https://api.clerk.com/v1', -- optional
  api_key_id '204da3d9-fe29-4389-88d5-e7fe4d64822c'
);

create schema if not exists clerk;

-- create all the foreign tables
import foreign schema clerk
from
  server clerk_server into clerk;
