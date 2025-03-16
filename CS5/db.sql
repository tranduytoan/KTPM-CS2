CREATE TABLE IF NOT EXISTS `article` (
	`id` integer primary key NOT NULL UNIQUE,
	`title` TEXT NOT NULL,
	`year` INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS `author` (
	`id` integer primary key NOT NULL UNIQUE,
	`name` TEXT NOT NULL,
	`email` TEXT
);
CREATE TABLE IF NOT EXISTS `article_author` (
	`article_id` INTEGER NOT NULL,
	`author_id` INTEGER NOT NULL,
FOREIGN KEY(`article_id`) REFERENCES `article`(`id`),
FOREIGN KEY(`author_id`) REFERENCES `author`(`id`)
);