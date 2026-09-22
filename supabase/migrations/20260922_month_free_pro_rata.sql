-- Month Free and Pro-Rata fields on units
alter table units
  add column if not exists month_free_applicable boolean not null default false,
  add column if not exists month_free_days        integer          default null,
  add column if not exists pro_rata_applicable    boolean not null default false;
