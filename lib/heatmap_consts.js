/*
 * Various constants used within heatmap
 */

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

const TAB_SESSION_COMPLETE = "tab-session-complete";
const DELETE_SERVER_DATA = "delete-server-data";
const DELETE_COMPLETED = "delete-server-data-completed";
const DELETE_FAILED = "delete-server-data-failed";
const UNINSTALL_ADDON = "uninstall-addon";

const STUDY_END_DATE = new Date(2016, 10, 15);

// Maximum number of records before we flush to disk
// Set this to 1 to flush all the time while debugging.
const FLUSH_SIZE = 10;

const BLOCKED_TLDS = ['adult', 'porn', 'sex', 'sexy', 'xxx'];

const CRYPTO_KEYS = {"e": "AQAB",
                     "n": "pu2VKNcaf34gbvrXn-wpC23-gJ3Ga6brxXIB8usHG35JqSSg51H9k5CQyLkpX6SVUnEcMUluOUfqpYgOUDYY4o1fKuL4q6J-d47FUo3okK2PKj5UE6g_-w90neZQ4-HHKQCyWAF4Bvh-_6j-cQV_ubDbNVLGN5s7w0r2I50bcUoR4lkB5mUoESCnRgcbSl5Q5-PRQXtkW_-UrHXK_wdBFsMVmz9Js6GLoKXBwV9X3qV8_upQpghbofUiNhiANgHyGamFcDEC04alqftrjsjm37k6An_ADCkbuRD3q1jONA15ENz3xgeg1o8XUWgs0EaW3YJMRyQM-JjIuG6KnBCdVw",
                     "kty": "RSA"};

const DOCUMENT_ONREADY = "PAGEMOD_DOCUMENT_READY";

exports.CRYPTO_KEYS = CRYPTO_KEYS;
exports.DELETE_COMPLETED = DELETE_COMPLETED;
exports.DELETE_FAILED = DELETE_FAILED;
exports.DELETE_SERVER_DATA = DELETE_SERVER_DATA;
exports.DOCUMENT_ONREADY = DOCUMENT_ONREADY;
exports.FLUSH_SIZE = FLUSH_SIZE;
exports.FS_CONST = FS_CONST;
exports.STUDY_END_DATE = STUDY_END_DATE;
exports.TAB_SESSION_COMPLETE = TAB_SESSION_COMPLETE;
exports.UNINSTALL_ADDON = UNINSTALL_ADDON;
exports.BLOCKED_TLDS = BLOCKED_TLDS;
