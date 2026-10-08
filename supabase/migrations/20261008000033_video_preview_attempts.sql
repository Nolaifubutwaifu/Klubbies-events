-- Videos whose preview the uploader's browser couldn't make get one from the
-- server (lib/media/video-previews.ts). A file ffmpeg can't read either is
-- tried a few times, then left alone, instead of every hour forever.
alter table public.media add column if not exists preview_attempts smallint not null default 0;
