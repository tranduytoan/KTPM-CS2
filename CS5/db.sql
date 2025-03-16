CREATE TABLE IF NOT EXISTS `release` (
	`name` text NOT NULL,
	`content` text NOT NULL,
	`repoID` int NOT NULL
);

CREATE TABLE IF NOT EXISTS `repo` (
	`id` int AUTO_INCREMENT NOT NULL UNIQUE,
	`user` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY (`id`)
);


ALTER TABLE `repo` ADD CONSTRAINT `repo_fk0` FOREIGN KEY (`id`) REFERENCES `release`(`repoID`);