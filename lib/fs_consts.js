// These constants are required to handle file streams, but aren't
// available through the addons SDK
// Note that these have been converted from octal to base10 because
// JS is terrible.
const FS_CONST = {
    PR_RDONLY: 1,
    PR_WRONLY: 2,
    PR_RDWR: 4,
    PR_CREATE_FILE: 8,
    PR_APPEND: 16,
    PR_TRUNCATE: 32,
    PR_SYNC: 64,
    PR_EXCL: 128
};

exports.FS_CONST = FS_CONST;
