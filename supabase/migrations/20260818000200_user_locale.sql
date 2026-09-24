-- UI language, per user.
--
-- Locale is a user setting, not a URL segment: every authenticated page is
-- already force-dynamic, so routing under /th and /en would double every path
-- and break existing links for nothing.
--
-- Headings stay English in both languages — see Report/12-i18n-spec.md §1.

alter table user_settings
  add column locale text not null default 'th'
  check (locale in ('th', 'en'));

comment on column user_settings.locale is
  'UI language: th | en. Headings, nav labels and table headers stay English in both.';
