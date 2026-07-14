CREATE TABLE `reddit_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon_img` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`scopes` text NOT NULL,
	`connected_at` integer NOT NULL
);
