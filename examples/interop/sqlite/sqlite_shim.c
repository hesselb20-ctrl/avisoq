/* A small SQLite binding for Avisoq (see notes.avq).

   Avisoq exchanges only whole numbers, floats, booleans and strings with C, so everything
   SQLite-specific stays here: the connection is handed to Avisoq as a number, and a query
   result comes back as text, one row per line with the columns separated by tabs.

   The few SQLite functions used are declared by hand, so no header file is needed: only the
   library itself (sqlite3.dll on Windows, libsqlite3 elsewhere). */
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef struct sqlite3 sqlite3;
typedef struct sqlite3_stmt sqlite3_stmt;
int sqlite3_open(const char *filename, sqlite3 **db);
int sqlite3_close(sqlite3 *db);
int sqlite3_exec(sqlite3 *db, const char *sql, int (*callback)(void *, int, char **, char **), void *arg, char **errmsg);
const char *sqlite3_errmsg(sqlite3 *db);
const char *sqlite3_libversion(void);
int sqlite3_prepare_v2(sqlite3 *db, const char *sql, int nbyte, sqlite3_stmt **stmt, const char **tail);
int sqlite3_bind_text(sqlite3_stmt *stmt, int index, const char *text, int nbyte, void (*destructor)(void *));
int sqlite3_bind_int64(sqlite3_stmt *stmt, int index, long long value);
int sqlite3_step(sqlite3_stmt *stmt);
int sqlite3_column_count(sqlite3_stmt *stmt);
const unsigned char *sqlite3_column_text(sqlite3_stmt *stmt, int column);
int sqlite3_finalize(sqlite3_stmt *stmt);
long long sqlite3_last_insert_rowid(sqlite3 *db);
int sqlite3_changes(sqlite3 *db);
#define SQLITE_OK 0
#define SQLITE_ROW 100
#define SQLITE_DONE 101
#define SQLITE_TRANSIENT ((void (*)(void *))(intptr_t)-1)

/* The text most recently returned to Avisoq. Avisoq copies a returned string at once, so one
   buffer, replaced on every call, is enough. */
static char *result = NULL;
static size_t result_len = 0, result_cap = 0;
static void put(const char *s, size_t n) {
  if (result_len + n + 1 > result_cap) {
    result_cap = (result_len + n + 1) * 2;
    result = (char *)realloc(result, result_cap);
  }
  memcpy(result + result_len, s, n);
  result_len += n;
  result[result_len] = 0;
}
static const char *start(void) { result_len = 0; put("", 0); return result; }

static char last_error[512] = "";
static void remember(sqlite3 *db) { strncpy(last_error, db ? sqlite3_errmsg(db) : "out of memory", sizeof last_error - 1); }

const char *db_version(void) { return sqlite3_libversion(); }

/* Opens a database file (":memory:" for one that lives in memory). Returns 0 on failure. */
long long db_open(const char *path) {
  sqlite3 *db = NULL;
  if (sqlite3_open(path, &db) != SQLITE_OK) { remember(db); sqlite3_close(db); return 0; }
  return (long long)(intptr_t)db;
}

void db_close(long long db) { sqlite3_close((sqlite3 *)(intptr_t)db); }

/* The reason the last call on this binding failed. */
const char *db_error(void) { return last_error; }

/* Runs statements that return nothing (CREATE, INSERT with literal values, ...). */
bool db_exec(long long db, const char *sql) {
  if (sqlite3_exec((sqlite3 *)(intptr_t)db, sql, NULL, NULL, NULL) == SQLITE_OK) return true;
  remember((sqlite3 *)(intptr_t)db);
  return false;
}

/* Runs one statement with a text and a number bound to ?1 and ?2, so values never have to be
   pasted into the SQL. Returns the new row id, or -1 on failure. */
long long db_insert(long long db, const char *sql, const char *text, long long number) {
  sqlite3 *d = (sqlite3 *)(intptr_t)db;
  sqlite3_stmt *st = NULL;
  if (sqlite3_prepare_v2(d, sql, -1, &st, NULL) != SQLITE_OK) { remember(d); return -1; }
  sqlite3_bind_text(st, 1, text, -1, SQLITE_TRANSIENT);
  sqlite3_bind_int64(st, 2, number);
  int rc = sqlite3_step(st);
  sqlite3_finalize(st);
  if (rc != SQLITE_DONE) { remember(d); return -1; }
  return sqlite3_last_insert_rowid(d);
}

/* Runs a query with a text bound to ?1 and returns its rows: columns separated by tabs, rows
   by newlines. Tabs and newlines inside a value are turned into spaces. Sets *ok. */
static bool query_ok = false;
const char *db_query(long long db, const char *sql, const char *text) {
  sqlite3 *d = (sqlite3 *)(intptr_t)db;
  sqlite3_stmt *st = NULL;
  query_ok = false;
  start();
  if (sqlite3_prepare_v2(d, sql, -1, &st, NULL) != SQLITE_OK) { remember(d); return result; }
  sqlite3_bind_text(st, 1, text, -1, SQLITE_TRANSIENT);
  int columns = sqlite3_column_count(st), rc;
  while ((rc = sqlite3_step(st)) == SQLITE_ROW) {
    if (result_len) put("\n", 1);
    for (int c = 0; c < columns; c++) {
      const char *v = (const char *)sqlite3_column_text(st, c);
      if (c) put("\t", 1);
      for (const char *p = v ? v : "NULL"; *p; p++) put(*p == '\t' || *p == '\n' || *p == '\r' ? " " : p, 1);
    }
  }
  sqlite3_finalize(st);
  if (rc != SQLITE_DONE) { remember(d); start(); return result; }
  query_ok = true;
  return result;
}
bool db_query_ok(void) { return query_ok; }
