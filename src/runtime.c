/* Avisoq native runtime. Included into every generated program (single translation unit).
   The generated code defines avisoq_sites[] before this text. */
#include <errno.h>
#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif
#ifdef _OPENMP
#include <omp.h>
#endif

#define VUNLIKELY(x) __builtin_expect(!!(x), 0)
#define VMAX_ARRAY_LEN (INT64_C(1) << 27)

/* Reserved failure sites. */
enum { VSITE_OOM = 0, VSITE_DIV_OVERFLOW = 1, VSITE_FLOAT_RANGE = 2, VSITE_FS_DENIED = 3, VSITE_NET_DENIED = 4, VSITE_RUN_DENIED = 5 };

#ifdef AVISOQ_SHARED
/* A shared library must never end the program that loaded it: a failure jumps back to
   avisoq_call(), which reports it. Shared builds are single-threaded for that reason. */
#ifdef _WIN32
/* MinGW: the compiler's own jump, which does not go through Windows unwinding. */
static void *avisoq_jmp[5];
#define VSETJMP() __builtin_setjmp(avisoq_jmp)
#define VLONGJMP() __builtin_longjmp(avisoq_jmp, 1)
#else
#include <setjmp.h>
static jmp_buf avisoq_jmp;
#define VSETJMP() setjmp(avisoq_jmp)
#define VLONGJMP() longjmp(avisoq_jmp, 1)
#endif
static int avisoq_failed_site;
#define VSITE_WIRE (-1)
#define VSITE_DENIED (-2)
#define VSITE_NOFN (-3)
#endif

#ifdef AVISOQ_SHARED
#define VSITE_TIME (-4)
#define VSITE_MEM (-5)
#endif

__attribute__((noreturn, cold, noinline)) static void avisoq_fail(int site) {
#ifdef AVISOQ_SHARED
  avisoq_failed_site = site;
  VLONGJMP();
#endif
#pragma omp critical(avisoq_fail_lock)
  {
    fflush(stdout);
    fprintf(stderr, "\001AVISOQFAIL %s\n", avisoq_sites[site]);
    fflush(stderr);
    _Exit(3);
  }
  __builtin_unreachable();
}

#ifdef AVISOQ_SHARED
/* Limits for one call, set with avisoq_limits(). Memory in use is the chunks taken since the
   call began plus the large blocks and maps that are alive, checked in the allocator's slow
   paths, so the limit is accurate to about a megabyte. Time is checked every 65536 loop rounds
   or calls, in libraries built with the budget option. */
static int64_t avisoq_mem_limit = 0, avisoq_mem_used = 0, avisoq_chunk0 = 0, avisoq_time_limit_ns = 0, avisoq_deadline = 0, avisoq_fuel = 0;
static int64_t avisoq_now_ns(void) { struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts); return (int64_t)ts.tv_sec * 1000000000 + ts.tv_nsec; }
__attribute__((cold, noinline)) static void avisoq_tick(void) {
  if (avisoq_deadline && avisoq_now_ns() > avisoq_deadline) avisoq_fail(VSITE_TIME);
  avisoq_fuel = 65536;
}
/* large blocks and maps: counted while they are alive */
#define VMEM(n) do { avisoq_mem_used += (int64_t)(n); if (VUNLIKELY(avisoq_mem_limit && avisoq_mem_used > avisoq_mem_limit)) { avisoq_mem_used -= (int64_t)(n); avisoq_fail(VSITE_MEM); } } while (0)
#define VMEM_FREE(n) do { avisoq_mem_used -= (int64_t)(n); } while (0)
/* about to take chunk number c */
#define VMEM_CHUNK(c) do { if (VUNLIKELY(avisoq_mem_limit && ((c) - avisoq_chunk0) * (int64_t)VARENA_CHUNK + avisoq_mem_used > avisoq_mem_limit)) avisoq_fail(VSITE_MEM); } while (0)
#else
#define VMEM(n) do { } while (0)
#define VMEM_FREE(n) do { } while (0)
#define VMEM_CHUNK(c) do { } while (0)
#endif
#if defined(AVISOQ_SHARED) && defined(AVISOQ_BUDGET)
/* VTICK: once per call. VTICKL: once per loop round, counted in a local of the function (_tk),
   which stays in a register; the clock is read every 16384 rounds. */
#define VTICK do { if (VUNLIKELY(--avisoq_fuel < 0)) avisoq_tick(); } while (0)
#define VTICKL do { if (VUNLIKELY(--_tk == 0)) { _tk = 16384; avisoq_tick(); } } while (0)
#else
#define VTICK do { } while (0)
#define VTICKL do { } while (0)
#endif

/* ---- memory: thread-local region allocator ----
   Small blocks are bump-allocated from 1 MB chunks; large blocks come from malloc and are
   linked so they can be returned. avisoq_mark() / avisoq_reset() bracket a region: the compiler
   inserts them where it has proved that nothing allocated inside can still be reachable. */
#define VARENA_CHUNK (1 << 20)
struct vmap;
typedef struct vbig { struct vbig *older; int64_t pad; } vbig;
typedef struct { char *p; char *end; int64_t chunk; vbig *big; struct vmap *maps; } vmark;
typedef struct { vmark cur; char **chunks; int64_t nchunks; } vtls;
/* Thread-local storage is an emulated function call with this toolchain, so the arena of the
   main thread is an ordinary global. Only while a parallel loop is running (VPAR counts them)
   does every thread, the main one included, use an arena of its own. A mark and its reset are
   always on the same side of a parallel loop, so they always see the same arena. */
static vtls VT_MAIN = { { NULL, NULL, -1, NULL, NULL }, NULL, 0 };
static _Thread_local vtls VT_THREAD = { { NULL, NULL, -1, NULL, NULL }, NULL, 0 };
static int VPAR = 0;
#define VPAR_IN __atomic_add_fetch(&VPAR, 1, __ATOMIC_SEQ_CST)
#define VPAR_OUT __atomic_sub_fetch(&VPAR, 1, __ATOMIC_SEQ_CST)
__attribute__((noinline)) static vtls *vt_thread(void) { return &VT_THREAD; }
static inline vtls *vt(void) { return VUNLIKELY(__atomic_load_n(&VPAR, __ATOMIC_RELAXED) != 0) ? vt_thread() : &VT_MAIN; }
static void vmap_release(struct vmap *m);
static struct vmap *vmap_older(struct vmap *m);

__attribute__((noinline)) static void *avisoq_alloc_slow(vtls *t, size_t n, bool zeroed) {
  if (n > 65536) {
    VMEM(n);
    vbig *big = (vbig *)(zeroed ? calloc(1, n + sizeof(vbig)) : malloc(n + sizeof(vbig)));
    if (big) big->pad = (int64_t)n;
    if (VUNLIKELY(!big)) avisoq_fail(VSITE_OOM);
    big->older = t->cur.big;
    t->cur.big = big;
    return big + 1;
  }
  if (VUNLIKELY((size_t)(t->cur.end - t->cur.p) < n)) {
    VMEM_CHUNK(t->cur.chunk + 1);
    t->cur.chunk++;
    if (t->cur.chunk >= t->nchunks) {
      t->chunks = (char **)realloc(t->chunks, sizeof(char *) * (size_t)(t->nchunks + 1));
      if (VUNLIKELY(!t->chunks)) avisoq_fail(VSITE_OOM);
      t->chunks[t->nchunks] = (char *)malloc(VARENA_CHUNK);
      if (VUNLIKELY(!t->chunks[t->nchunks])) avisoq_fail(VSITE_OOM);
      t->nchunks++;
    }
    t->cur.p = t->chunks[t->cur.chunk];
    t->cur.end = t->cur.p + VARENA_CHUNK;
  }
  void *p = t->cur.p;
  t->cur.p += n;
  if (zeroed) memset(p, 0, n);
  return p;
}

/* The common case is a pointer bump. */
static inline void *avisoq_alloc(size_t n, bool zeroed) {
  vtls *t = vt();
  n = (n + 15) & ~(size_t)15;
  if (VUNLIKELY(n > 65536 || (size_t)(t->cur.end - t->cur.p) < n)) return avisoq_alloc_slow(t, n, zeroed);
  void *p = t->cur.p;
  t->cur.p += n;
  if (zeroed) memset(p, 0, n);
  return p;
}

static inline vmark avisoq_mark(void) { return vt()->cur; }

__attribute__((noinline)) static void avisoq_reset_slow(vtls *t, vmark m) {
  while (t->cur.big != m.big) {
    vbig *b = t->cur.big;
    t->cur.big = b->older;
    VMEM_FREE(b->pad);
    free(b);
  }
  while (t->cur.maps != m.maps) {
    struct vmap *mp = t->cur.maps;
    t->cur.maps = vmap_older(mp);
    vmap_release(mp);
  }
  t->cur = m;
}

/* Usually nothing large and no map was created inside the region: restoring the mark is all. */
static inline void avisoq_reset(vmark m) {
  vtls *t = vt();
#ifdef AVISOQ_POISON
  /* Test builds: overwrite everything being handed back, after the maps in it are released
     (their headers live in this memory). */
  vmark was = t->cur;
  if (t->cur.big != m.big || t->cur.maps != m.maps) avisoq_reset_slow(t, m);
  for (int64_t c = m.chunk < 0 ? 0 : m.chunk; c <= was.chunk; c++) {
    char *lo = c == m.chunk ? m.p : t->chunks[c];
    char *hi = c == was.chunk ? was.p : t->chunks[c] + VARENA_CHUNK;
    if (hi > lo) memset(lo, 0xA5, (size_t)(hi - lo));
  }
  t->cur = m;
  return;
#endif
  if (VUNLIKELY(t->cur.big != m.big || t->cur.maps != m.maps)) { avisoq_reset_slow(t, m); return; }
  t->cur = m;
}

/* ---- arrays: 16-byte header, elements follow ---- */
typedef struct { int64_t len; int64_t cap; } varr;
#define VDATA(T, a) ((T *)((a) + 1))

static varr *avisoq_arr_alloc(int64_t n, size_t elem, int site, bool zeroed) {
  if (VUNLIKELY((uint64_t)n > (uint64_t)VMAX_ARRAY_LEN)) avisoq_fail(site);
  varr *a = (varr *)avisoq_alloc(sizeof(varr) + (size_t)n * elem, zeroed);
  a->len = n;
  a->cap = n;
  return a;
}

/* Makes room for one more element and returns its address. The array may move, so the
   caller's variable is updated through the pointer. Capacity doubles: adding is amortised O(1). */
static void *avisoq_push(varr **slot, size_t elem) {
  varr *a = *slot;
  if (a->len == a->cap) {
    int64_t cap = a->cap ? a->cap * 2 : 4;
    if (VUNLIKELY(cap > VMAX_ARRAY_LEN)) { if (a->len >= VMAX_ARRAY_LEN) avisoq_fail(VSITE_OOM); cap = VMAX_ARRAY_LEN; }
    varr *n = (varr *)avisoq_alloc(sizeof(varr) + (size_t)cap * elem, false);
    n->len = a->len;
    n->cap = cap;
    memcpy(n + 1, a + 1, (size_t)a->len * elem);
    *slot = a = n;
  }
  return (char *)(a + 1) + elem * (size_t)a->len++;
}

/* ---- checked arithmetic ---- */
static inline int64_t vadd(int64_t a, int64_t b, int site) {
  int64_t r;
  if (VUNLIKELY(__builtin_add_overflow(a, b, &r))) avisoq_fail(site);
  return r;
}
static inline int64_t vsub(int64_t a, int64_t b, int site) {
  int64_t r;
  if (VUNLIKELY(__builtin_sub_overflow(a, b, &r))) avisoq_fail(site);
  return r;
}
static inline int64_t vmul(int64_t a, int64_t b, int site) {
  int64_t r;
  if (VUNLIKELY(__builtin_mul_overflow(a, b, &r))) avisoq_fail(site);
  return r;
}
/* Multiply by a constant c >= 1. The range test runs beside the multiply instead of after it. */
static inline int64_t vmulc(int64_t x, int64_t c, int site) {
  if (VUNLIKELY(x > INT64_MAX / c || x < INT64_MIN / c)) avisoq_fail(site);
  return (int64_t)((uint64_t)x * (uint64_t)c);
}
static inline int64_t vwadd(int64_t a, int64_t b) { return (int64_t)((uint64_t)a + (uint64_t)b); }
static inline int64_t vwsub(int64_t a, int64_t b) { return (int64_t)((uint64_t)a - (uint64_t)b); }
static inline int64_t vwmul(int64_t a, int64_t b) { return (int64_t)((uint64_t)a * (uint64_t)b); }
/* Shifts: the count must be 0 to 63. Bits shifted out are dropped; a right shift keeps the sign. */
static inline int64_t vshl(int64_t a, int64_t n, int site) {
  if (VUNLIKELY((uint64_t)n > 63)) avisoq_fail(site);
  return (int64_t)((uint64_t)a << n);
}
static inline int64_t vshr(int64_t a, int64_t n, int site) {
  if (VUNLIKELY((uint64_t)n > 63)) avisoq_fail(site);
  return a >> n;
}
static inline int64_t vdiv(int64_t a, int64_t b, int site) {
  if (VUNLIKELY(b == 0)) avisoq_fail(site);
  if (VUNLIKELY(b == -1 && a == INT64_MIN)) avisoq_fail(VSITE_DIV_OVERFLOW);
  return a / b;
}
static inline int64_t vmod(int64_t a, int64_t b, int site) {
  if (VUNLIKELY(b == 0)) avisoq_fail(site);
  if (VUNLIKELY(b == -1)) return 0;
  return a % b;
}
static inline int64_t vf2i(double x) {
  if (VUNLIKELY(!(x > -9223372036854777856.0 && x < 9223372036854775808.0))) avisoq_fail(VSITE_FLOAT_RANGE);
  return (int64_t)x;
}

/* ---- strings: immutable, length-prefixed UTF-8 ---- */
typedef struct { int64_t len; char data[]; } vstr;

static vstr *vstr_new(int64_t len) {
  vstr *s = (vstr *)avisoq_alloc(sizeof(vstr) + (size_t)len + 1, false);
  s->len = len;
  s->data[len] = 0;
  return s;
}
static const vstr *vstr_from_buf(const char *buf) {
  int64_t n = (int64_t)strlen(buf);
  vstr *s = vstr_new(n);
  memcpy(s->data, buf, (size_t)n);
  return s;
}
static const vstr *vstr_concat(const vstr *a, const vstr *b) {
  vstr *s = vstr_new(a->len + b->len);
  memcpy(s->data, a->data, (size_t)a->len);
  memcpy(s->data + a->len, b->data, (size_t)b->len);
  return s;
}
static bool vstr_eq(const vstr *a, const vstr *b) {
  return a->len == b->len && memcmp(a->data, b->data, (size_t)a->len) == 0;
}
/* Byte-wise ordering: negative, zero or positive. */
static int vstr_cmp(const vstr *a, const vstr *b) {
  int64_t n = a->len < b->len ? a->len : b->len;
  int c = n ? memcmp(a->data, b->data, (size_t)n) : 0;
  return c ? c : (a->len > b->len) - (a->len < b->len);
}
static const vstr *vstr_substr(const vstr *s, int64_t start, int64_t end, int site) {
  if (VUNLIKELY(start < 0 || end < start || end > s->len)) avisoq_fail(site);
  vstr *r = vstr_new(end - start);
  memcpy(r->data, s->data + start, (size_t)(end - start));
  return r;
}
/* A one-byte string. There are only 256 of them, made once. */
static vstr *VCHR[256];
static inline const vstr *vstr_from_byte(int64_t b, int site) {
  if (VUNLIKELY((uint64_t)b > 255)) avisoq_fail(site);
  return VCHR[b];
}
/* x = x + b for a variable that is built up piece by piece. When the variable owns its buffer
   (nothing else has been given the string since it was last copied) and there is room, the
   bytes are added in place; otherwise the string moves to a buffer twice the size. */
static const vstr *vstr_append(const vstr *a, int64_t *cap, bool *shared, const vstr *b) {
  int64_t n = a->len + b->len;
  if (!*shared && n <= *cap) {
    vstr *m = (vstr *)a;
    memcpy(m->data + m->len, b->data, (size_t)b->len);
    m->len = n;
    m->data[n] = 0;
    return a;
  }
  int64_t c = n < 24 ? 48 : n * 2;
  vstr *s = vstr_new(c);
  memcpy(s->data, a->data, (size_t)a->len);
  memcpy(s->data + a->len, b->data, (size_t)b->len);
  s->len = n;
  s->data[n] = 0;
  *cap = c;
  *shared = false;
  return s;
}
static int64_t vstr_byte_at(const vstr *s, int64_t i, int site) {
  if (VUNLIKELY((uint64_t)i >= (uint64_t)s->len)) avisoq_fail(site);
  return (unsigned char)s->data[i];
}

/* ---- maps: insertion-ordered hash maps with Int or Str keys ----
   The header lives in the region allocator; the tables are malloc'd and released when the
   region that created the map is reset. */
typedef struct vmap {
  int64_t len, cap, nslots;
  int32_t *slots;   /* open addressing: entry index + 1, or 0 when empty */
  uint64_t *keys;
  char *vals;
  int64_t vsize;
  int64_t strkeys;
  struct vmap *older;
} vmap;

static struct vmap *vmap_older(struct vmap *m) { return m->older; }
#define VMAP_BYTES(m, cap) ((cap) * (int64_t)(sizeof(uint64_t) + (size_t)(m)->vsize + 2 * sizeof(int32_t)))
static void vmap_release(struct vmap *m) { VMEM_FREE(VMAP_BYTES(m, m->cap)); free(m->slots); free(m->keys); free(m->vals); }

static vmap *vmap_new(int64_t vsize, int strkeys) {
  vmap *m = (vmap *)avisoq_alloc(sizeof(vmap), true);
  m->vsize = vsize;
  m->strkeys = strkeys;
  m->older = vt()->cur.maps;
  vt()->cur.maps = m;
  return m;
}
static inline uint64_t vmap_hash(const vmap *m, uint64_t key) {
  if (m->strkeys) {
    const vstr *s = (const vstr *)(uintptr_t)key;
    uint64_t h = UINT64_C(1469598103934665603);
    for (int64_t i = 0; i < s->len; i++) { h ^= (unsigned char)s->data[i]; h *= UINT64_C(1099511628211); }
    return h;
  }
  key ^= key >> 33; key *= UINT64_C(0xff51afd7ed558ccd);
  key ^= key >> 33; key *= UINT64_C(0xc4ceb9fe1a85ec53);
  return key ^ (key >> 33);
}
static inline bool vmap_keq(const vmap *m, uint64_t a, uint64_t b) {
  return m->strkeys ? vstr_eq((const vstr *)(uintptr_t)a, (const vstr *)(uintptr_t)b) : a == b;
}
static int64_t vmap_find(const vmap *m, uint64_t key) {
  if (!m->nslots) return -1;
  uint64_t mask = (uint64_t)m->nslots - 1, h = vmap_hash(m, key) & mask;
  for (;;) {
    int32_t s = m->slots[h];
    if (!s) return -1;
    if (vmap_keq(m, m->keys[s - 1], key)) return s - 1;
    h = (h + 1) & mask;
  }
}
static void vmap_link(vmap *m, int64_t idx) {
  uint64_t mask = (uint64_t)m->nslots - 1, h = vmap_hash(m, m->keys[idx]) & mask;
  while (m->slots[h]) h = (h + 1) & mask;
  m->slots[h] = (int32_t)(idx + 1);
}
/* Returns the address of the value slot for key, adding the key if it is new. */
static void *vmap_put(vmap *m, uint64_t key) {
  int64_t idx = vmap_find(m, key);
  if (idx >= 0) return m->vals + idx * m->vsize;
  if (m->len == m->cap) {
    int64_t cap = m->cap ? m->cap * 2 : 8;
    if (VUNLIKELY(cap > (INT64_C(1) << 30))) avisoq_fail(VSITE_OOM);
    VMEM(VMAP_BYTES(m, cap - m->cap));
    m->keys = (uint64_t *)realloc(m->keys, (size_t)cap * sizeof(uint64_t));
    m->vals = (char *)realloc(m->vals, (size_t)(cap * m->vsize));
    free(m->slots);
    m->nslots = cap * 2;
    m->slots = (int32_t *)calloc((size_t)m->nslots, sizeof(int32_t));
    if (VUNLIKELY(!m->keys || !m->vals || !m->slots)) avisoq_fail(VSITE_OOM);
    m->cap = cap;
    for (int64_t i = 0; i < m->len; i++) vmap_link(m, i);
  }
  idx = m->len++;
  m->keys[idx] = key;
  vmap_link(m, idx);
  return m->vals + idx * m->vsize;
}
static void *vmap_peek(const vmap *m, uint64_t key) {
  int64_t idx = vmap_find(m, key);
  return idx < 0 ? NULL : m->vals + idx * m->vsize;
}
static void *vmap_get(const vmap *m, uint64_t key, int site) {
  int64_t idx = vmap_find(m, key);
  if (VUNLIKELY(idx < 0)) avisoq_fail(site);
  return m->vals + idx * m->vsize;
}
static varr *vmap_keys(const vmap *m, int site) {
  varr *a = avisoq_arr_alloc(m->len, sizeof(uint64_t), site, false);
  if (m->len) memcpy(VDATA(uint64_t, a), m->keys, (size_t)m->len * sizeof(uint64_t));
  return a;
}

static bool vmap_remove(vmap *m, uint64_t key) {
  int64_t idx = vmap_find(m, key);
  if (idx < 0) return false;
  /* Keep insertion order: close the gap, then rebuild the index. */
  memmove(m->keys + idx, m->keys + idx + 1, (size_t)(m->len - idx - 1) * sizeof(uint64_t));
  memmove(m->vals + idx * m->vsize, m->vals + (idx + 1) * m->vsize, (size_t)((m->len - idx - 1) * m->vsize));
  m->len--;
  memset(m->slots, 0, (size_t)m->nslots * sizeof(int32_t));
  for (int64_t i = 0; i < m->len; i++) vmap_link(m, i);
  return true;
}

/* ---- fs capability: only inside the folders granted at build time ---- */
static bool avisoq_path_ok(const vstr *path, char *full) {
#ifdef _WIN32
  if (!_fullpath(full, path->data, 4096)) return false;
#else
  if (!realpath(path->data, full)) {
    /* A file that does not exist yet: resolve the folder it would be in, so that links in the
       path (macOS keeps temporary folders behind one) are followed just as for the granted roots. */
    if (path->len >= 4000) return false;
    char dir[4096];
    memcpy(dir, path->data, (size_t)path->len + 1);
    char *slash = strrchr(dir, '/');
    if (slash && slash != dir) {
      *slash = 0;
      char real[4096];
      if (realpath(dir, real) && strlen(real) + strlen(slash + 1) + 2 < 4096) snprintf(full, 4096, "%s/%s", real, slash + 1);
      else memcpy(full, path->data, (size_t)path->len + 1);
    } else memcpy(full, path->data, (size_t)path->len + 1);
  }
#endif
  if (avisoq_fs_any) return true;
  for (int i = 0; avisoq_fs_roots[i]; i++) {
#ifdef _WIN32
    size_t n = strlen(avisoq_fs_roots[i]);
    if (_strnicmp(full, avisoq_fs_roots[i], n) != 0) continue;
#else
    char rootreal[4096];
    const char *root = realpath(avisoq_fs_roots[i], rootreal) ? rootreal : avisoq_fs_roots[i];
    size_t n = strlen(root);
    if (strncmp(full, root, n) != 0) continue;
#endif
    if (full[n] == 0 || full[n] == '\\' || full[n] == '/') return true;
  }
  return false;
}
static const vstr *avisoq_io_error(void) {
  switch (errno) {
    case ENOENT: return vstr_from_buf("not found");
    case EACCES: case EPERM: return vstr_from_buf("permission denied");
    case EISDIR: return vstr_from_buf("is a directory");
    default: return vstr_from_buf("io error");
  }
}
/* Returns the content and sets *ok, or returns the reason it failed. */
static const vstr *avisoq_read_file(const vstr *path, bool *ok) {
  char full[4096];
  *ok = false;
  if (!avisoq_path_ok(path, full)) avisoq_fail(VSITE_FS_DENIED);
  FILE *f = fopen(full, "rb");
  if (!f) return avisoq_io_error();
  if (fseek(f, 0, SEEK_END) != 0) { fclose(f); return vstr_from_buf("is a directory"); }
  long n = ftell(f);
  fseek(f, 0, SEEK_SET);
  if (n < 0) { fclose(f); return vstr_from_buf("io error"); }
  vstr *s = vstr_new((int64_t)n);
  size_t got = fread(s->data, 1, (size_t)n, f);
  fclose(f);
  if (got != (size_t)n) return vstr_from_buf("io error");
  *ok = true;
  return s;
}
/* Returns the number of bytes written and sets *ok, or stores the reason in *why. */
static int64_t avisoq_write_file(const vstr *path, const vstr *content, bool *ok, const vstr **why) {
  char full[4096];
  *ok = false;
  if (!avisoq_path_ok(path, full)) avisoq_fail(VSITE_FS_DENIED);
  FILE *f = fopen(full, "wb");
  if (!f) { *why = avisoq_io_error(); return 0; }
  size_t put = fwrite(content->data, 1, (size_t)content->len, f);
  if (fclose(f) != 0 || put != (size_t)content->len) { *why = vstr_from_buf("io error"); return 0; }
  *ok = true;
  return content->len;
}

/* ---- net capability: only to the hosts granted at build time ---- */
#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
static wchar_t *avisoq_wide(const char *s, int len) {
  int n = MultiByteToWideChar(CP_UTF8, 0, s, len, NULL, 0);
  wchar_t *w = (wchar_t *)malloc(((size_t)n + 1) * sizeof(wchar_t));
  MultiByteToWideChar(CP_UTF8, 0, s, len, w, n);
  w[n] = 0;
  return w;
}
static const vstr *avisoq_http(const char *method, const vstr *url, const vstr *body, const vstr *ctype, bool *ok) {
  *ok = false;
  wchar_t *wurl = avisoq_wide(url->data, (int)url->len);
  wchar_t host[256], path[4096], extra[4096];
  URL_COMPONENTS uc;
  memset(&uc, 0, sizeof uc);
  uc.dwStructSize = sizeof uc;
  uc.lpszHostName = host; uc.dwHostNameLength = 256;
  uc.lpszUrlPath = path; uc.dwUrlPathLength = 2048;
  uc.lpszExtraInfo = extra; uc.dwExtraInfoLength = 2048;
  if (!WinHttpCrackUrl(wurl, 0, 0, &uc) || (uc.nScheme != INTERNET_SCHEME_HTTP && uc.nScheme != INTERNET_SCHEME_HTTPS)) {
    free(wurl);
    return vstr_from_buf("bad url");
  }
  free(wurl);
  char hostu[256];
  WideCharToMultiByte(CP_UTF8, 0, host, -1, hostu, sizeof hostu, NULL, NULL);
  if (!avisoq_net_any) {
    bool allowed = false;
    for (int i = 0; avisoq_net_hosts[i]; i++) if (_stricmp(hostu, avisoq_net_hosts[i]) == 0) allowed = true;
    if (!allowed) avisoq_fail(VSITE_NET_DENIED);
  }
  wcsncat(path, extra, 2047);
  const vstr *result = NULL;
  wchar_t *hdr = NULL;
  HINTERNET s = WinHttpOpen(L"avisoq", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
  HINTERNET c = s ? WinHttpConnect(s, host, uc.nPort, 0) : NULL;
  HINTERNET r = c ? WinHttpOpenRequest(c, strcmp(method, "POST") == 0 ? L"POST" : L"GET", path, NULL, WINHTTP_NO_REFERER,
                                       WINHTTP_DEFAULT_ACCEPT_TYPES, uc.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0) : NULL;
  if (r) {
    WinHttpSetTimeouts(r, 10000, 10000, 30000, 30000);
    DWORD blen = body ? (DWORD)body->len : 0;
    if (ctype) {
      wchar_t *wc = avisoq_wide(ctype->data, (int)ctype->len);
      size_t n = wcslen(wc) + 32;
      hdr = (wchar_t *)malloc(n * sizeof(wchar_t));
      _snwprintf(hdr, n, L"Content-Type: %ls", wc);
      free(wc);
    }
    DWORD status = 0, sz = sizeof status;
    if (WinHttpSendRequest(r, hdr ? hdr : WINHTTP_NO_ADDITIONAL_HEADERS, hdr ? (DWORD)-1L : 0, body ? (LPVOID)body->data : WINHTTP_NO_REQUEST_DATA, blen, blen, 0)
        && WinHttpReceiveResponse(r, NULL)
        && WinHttpQueryHeaders(r, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, WINHTTP_HEADER_NAME_BY_INDEX, &status, &sz, WINHTTP_NO_HEADER_INDEX)) {
      size_t cap = 65536, len = 0;
      char *buf = (char *)malloc(cap);
      bool readOk = buf != NULL;
      while (readOk) {
        DWORD got = 0;
        if (len + 32768 > cap) { cap *= 2; buf = (char *)realloc(buf, cap); if (!buf) { readOk = false; break; } }
        if (!WinHttpReadData(r, buf + len, 32768, &got)) { readOk = false; break; }
        if (got == 0) break;
        len += got;
      }
      if (!readOk) {
        result = vstr_from_buf("connection failed");
      } else if (status < 200 || status >= 300) {
        char msg[64];
        snprintf(msg, sizeof msg, "http status %lu", (unsigned long)status);
        result = vstr_from_buf(msg);
      } else {
        vstr *out = vstr_new((int64_t)len);
        memcpy(out->data, buf, len);
        result = out;
        *ok = true;
      }
      free(buf);
    }
  }
  free(hdr);
  if (r) WinHttpCloseHandle(r);
  if (c) WinHttpCloseHandle(c);
  if (s) WinHttpCloseHandle(s);
  return result ? result : vstr_from_buf("connection failed");
}
#else
/* Linux and macOS: a small HTTP/1.0 client over a socket. Plain http only; an https address
   is answered with an error value, because there is no TLS library to rely on here. */
#include <netdb.h>
#include <strings.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>
static const vstr *avisoq_http(const char *method, const vstr *url, const vstr *body, const vstr *ctype, bool *ok) {
  *ok = false;
  const char *u = url->data;
  bool tls = strncmp(u, "https://", 8) == 0;
  if (!tls && strncmp(u, "http://", 7) != 0) return vstr_from_buf("bad url");
  u += tls ? 8 : 7;
  char host[256], port[8];
  size_t hn = strcspn(u, ":/?#");
  if (hn == 0 || hn >= sizeof host) return vstr_from_buf("bad url");
  memcpy(host, u, hn);
  host[hn] = 0;
  for (size_t i = 0; i < hn; i++) if (host[i] >= 'A' && host[i] <= 'Z') host[i] = (char)(host[i] + 32);
  u += hn;
  snprintf(port, sizeof port, "%s", tls ? "443" : "80");
  if (*u == ':') {
    size_t pn = strspn(u + 1, "0123456789");
    if (pn == 0 || pn >= sizeof port) return vstr_from_buf("bad url");
    memcpy(port, u + 1, pn);
    port[pn] = 0;
    u += 1 + pn;
  }
  if (!avisoq_net_any) {
    bool granted = false;
    for (int i = 0; avisoq_net_hosts[i]; i++) if (strcmp(host, avisoq_net_hosts[i]) == 0) granted = true;
    if (!granted) avisoq_fail(VSITE_NET_DENIED);
  }
  if (tls) return vstr_from_buf("https is not available in native builds on this platform yet");
  const char *path = *u ? u : "/";
  struct addrinfo hints, *found = NULL;
  memset(&hints, 0, sizeof hints);
  hints.ai_socktype = SOCK_STREAM;
  if (getaddrinfo(host, port, &hints, &found) != 0 || !found) return vstr_from_buf("connection failed");
  int fd = -1;
  for (struct addrinfo *a = found; a; a = a->ai_next) {
    fd = socket(a->ai_family, a->ai_socktype, a->ai_protocol);
    if (fd < 0) continue;
    struct timeval limit = { 30, 0 };
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &limit, sizeof limit);
    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &limit, sizeof limit);
    if (connect(fd, a->ai_addr, a->ai_addrlen) == 0) break;
    close(fd);
    fd = -1;
  }
  freeaddrinfo(found);
  if (fd < 0) return vstr_from_buf("connection failed");
  size_t cap = 65536, len = 0;
  char *buf = (char *)malloc(cap);
  if (!buf) { close(fd); return vstr_from_buf("connection failed"); }
  int head = snprintf(buf, cap, "%s %s%s HTTP/1.0\r\nHost: %s\r\nConnection: close\r\n", method, *path == '/' ? "" : "/", path, host);
  if (body) head += snprintf(buf + head, cap - (size_t)head, "Content-Type: %s\r\nContent-Length: %lld\r\n", ctype ? ctype->data : "text/plain", (long long)body->len);
  head += snprintf(buf + head, cap - (size_t)head, "\r\n");
  bool sent = head > 0 && (size_t)head < cap && send(fd, buf, (size_t)head, 0) == head;
  if (sent && body && body->len) sent = send(fd, body->data, (size_t)body->len, 0) == (ssize_t)body->len;
  if (!sent) { free(buf); close(fd); return vstr_from_buf("connection failed"); }
  for (;;) {
    if (len + 32768 > cap) { cap *= 2; char *b = (char *)realloc(buf, cap); if (!b) { free(buf); close(fd); return vstr_from_buf("connection failed"); } buf = b; }
    ssize_t got = recv(fd, buf + len, cap - len - 1, 0);
    if (got <= 0) break;
    len += (size_t)got;
  }
  close(fd);
  buf[len] = 0;
  int status = 0;
  char *end = strstr(buf, "\r\n\r\n");
  if (len < 12 || strncmp(buf, "HTTP/", 5) != 0 || !end || sscanf(buf, "HTTP/%*s %d", &status) != 1) { free(buf); return vstr_from_buf("connection failed"); }
  const vstr *result;
  if (status < 200 || status >= 300) {
    char msg[48];
    snprintf(msg, sizeof msg, "http status %d", status);
    result = vstr_from_buf(msg);
  } else {
    size_t n = len - (size_t)(end + 4 - buf);
    vstr *s = vstr_new((int64_t)n);
    memcpy(s->data, end + 4, n);
    result = s;
    *ok = true;
  }
  free(buf);
  return result;
}
#endif

/* ---- running another program (capability run) ----
   The program is started directly, never through a shell, so arguments cannot be reinterpreted.
   Its input comes from a temporary file and its output goes to temporary files. */
static bool avisoq_run_allowed(const vstr *program) {
  if (avisoq_run_any) return true;
  for (int i = 0; avisoq_run_programs[i]; i++) {
#ifdef _WIN32
    if (_stricmp(program->data, avisoq_run_programs[i]) == 0) return true;
#else
    if (strcmp(program->data, avisoq_run_programs[i]) == 0) return true;
#endif
  }
  return false;
}
#ifdef _WIN32
typedef struct { char *p; size_t len, cap; } vcmd;
static void vcmd_put(vcmd *c, const char *s, size_t n) {
  if (c->len + n + 1 > c->cap) { c->cap = (c->len + n + 1) * 2; c->p = (char *)realloc(c->p, c->cap); if (!c->p) avisoq_fail(VSITE_OOM); }
  memcpy(c->p + c->len, s, n);
  c->len += n;
  c->p[c->len] = 0;
}
/* Quotes one argument the way the child's C runtime will split the command line back apart. */
static void vcmd_arg(vcmd *c, const char *a) {
  bool plain = *a != 0;
  for (const char *p = a; *p; p++) if (*p == ' ' || *p == '\t' || *p == '"') plain = false;
  if (plain) { vcmd_put(c, a, strlen(a)); return; }
  vcmd_put(c, "\"", 1);
  size_t slashes = 0;
  for (const char *p = a;; p++) {
    if (*p == '\\') { slashes++; continue; }
    if (*p == 0) { for (size_t i = 0; i < slashes * 2; i++) vcmd_put(c, "\\", 1); break; }
    if (*p == '"') { for (size_t i = 0; i < slashes * 2 + 1; i++) vcmd_put(c, "\\", 1); vcmd_put(c, "\"", 1); }
    else { for (size_t i = 0; i < slashes; i++) vcmd_put(c, "\\", 1); vcmd_put(c, p, 1); }
    slashes = 0;
  }
  vcmd_put(c, "\"", 1);
}
static const vstr *vrun_read(HANDLE h, int64_t limit) {
  LARGE_INTEGER size;
  if (!GetFileSizeEx(h, &size)) return vstr_new(0);
  int64_t n = size.QuadPart;
  if (limit >= 0 && n > limit) n = limit;
  if (n > (INT64_C(1) << 30)) n = INT64_C(1) << 30;
  vstr *s = vstr_new(n);
  SetFilePointer(h, 0, NULL, FILE_BEGIN);
  int64_t got = 0;
  while (got < n) {
    DWORD r = 0;
    if (!ReadFile(h, s->data + got, (DWORD)(n - got), &r, NULL) || r == 0) break;
    got += r;
  }
  s->len = got;
  s->data[got] = 0;
  return s;
}
static const vstr *avisoq_run(const vstr *program, const varr *args, const vstr *input, bool *ok) {
  *ok = false;
  if (!avisoq_run_allowed(program)) avisoq_fail(VSITE_RUN_DENIED);
  vcmd c = { NULL, 0, 0 };
  vcmd_arg(&c, program->data);
  const vstr *const *av = VDATA(const vstr *, (varr *)args);
  for (int64_t i = 0; i < args->len; i++) { vcmd_put(&c, " ", 1); vcmd_arg(&c, av[i]->data); }
  wchar_t *wcmd = avisoq_wide(c.p, (int)c.len);
  wchar_t dir[MAX_PATH], fin[MAX_PATH], fout[MAX_PATH], ferr[MAX_PATH];
  GetTempPathW(MAX_PATH, dir);
  GetTempFileNameW(dir, L"avi", 0, fin);
  GetTempFileNameW(dir, L"avo", 0, fout);
  GetTempFileNameW(dir, L"ave", 0, ferr);
  HANDLE h = CreateFileW(fin, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_TEMPORARY, NULL);
  int64_t sent = 0;
  while (h != INVALID_HANDLE_VALUE && sent < input->len) {
    DWORD w = 0;
    if (!WriteFile(h, input->data + sent, (DWORD)(input->len - sent > 1 << 20 ? 1 << 20 : input->len - sent), &w, NULL) || w == 0) break;
    sent += w;
  }
  if (h != INVALID_HANDLE_VALUE) CloseHandle(h);
  SECURITY_ATTRIBUTES sa = { sizeof sa, NULL, TRUE };
  HANDLE hin = CreateFileW(fin, GENERIC_READ, FILE_SHARE_READ, &sa, OPEN_EXISTING, FILE_ATTRIBUTE_TEMPORARY, NULL);
  HANDLE hout = CreateFileW(fout, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, &sa, CREATE_ALWAYS, FILE_ATTRIBUTE_TEMPORARY, NULL);
  HANDLE herr = CreateFileW(ferr, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, &sa, CREATE_ALWAYS, FILE_ATTRIBUTE_TEMPORARY, NULL);
  STARTUPINFOW si;
  memset(&si, 0, sizeof si);
  si.cb = sizeof si;
  si.dwFlags = STARTF_USESTDHANDLES;
  si.hStdInput = hin;
  si.hStdOutput = hout;
  si.hStdError = herr;
  PROCESS_INFORMATION pi;
  const vstr *result;
  if (!CreateProcessW(NULL, wcmd, NULL, NULL, TRUE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
    result = vstr_from_buf("not found");
  } else {
    if (WaitForSingleObject(pi.hProcess, 60000) != WAIT_OBJECT_0) {
      TerminateProcess(pi.hProcess, 1);
      result = vstr_from_buf("timed out");
    } else {
      DWORD code = 0;
      GetExitCodeProcess(pi.hProcess, &code);
      if (code == 0) {
        result = vrun_read(hout, -1);
        *ok = true;
      } else {
        const vstr *e = vrun_read(herr, 8000);
        int64_t a = 0, b = e->len;
        while (a < b && (e->data[a] == ' ' || e->data[a] == '\t' || e->data[a] == '\r' || e->data[a] == '\n')) a++;
        while (b > a && (e->data[b - 1] == ' ' || e->data[b - 1] == '\t' || e->data[b - 1] == '\r' || e->data[b - 1] == '\n')) b--;
        if (b - a > 2000) b = a + 2000;
        char head[48];
        int hn = snprintf(head, sizeof head, "exit %lu: ", (unsigned long)code);
        vstr *s = vstr_new(hn + (b - a));
        memcpy(s->data, head, (size_t)hn);
        memcpy(s->data + hn, e->data + a, (size_t)(b - a));
        result = s;
      }
    }
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
  }
  if (hin != INVALID_HANDLE_VALUE) CloseHandle(hin);
  if (hout != INVALID_HANDLE_VALUE) CloseHandle(hout);
  if (herr != INVALID_HANDLE_VALUE) CloseHandle(herr);
  DeleteFileW(fin);
  DeleteFileW(fout);
  DeleteFileW(ferr);
  free(wcmd);
  free(c.p);
  return result;
}
#else
static const vstr *avisoq_run(const vstr *program, const varr *args, const vstr *input, bool *ok) {
  (void)args; (void)input;
  *ok = false;
  if (!avisoq_run_allowed(program)) avisoq_fail(VSITE_RUN_DENIED);
  return vstr_from_buf("run_command is not available in native programs on this platform");
}
#endif

static bool avisoq_file_exists(const vstr *path) {
  char full[4096];
  if (!avisoq_path_ok(path, full)) avisoq_fail(VSITE_FS_DENIED);
  FILE *f = fopen(full, "rb");
  if (f) fclose(f);
  return f != NULL;
}

/* Formats a double the way the WebAssembly host does: shortest text that round-trips,
   with ".0" on whole numbers. */
static void vfmt_f64(double x, char *out) {
  if (x != x) { strcpy(out, "NaN"); return; }
  if (isinf(x)) { strcpy(out, x > 0 ? "Infinity" : "-Infinity"); return; }
  if (x == floor(x) && fabs(x) < 1e21) { snprintf(out, 64, "%.1f", x); return; }
  char buf[40];
  for (int p = 1; p <= 17; p++) {
    snprintf(buf, sizeof buf, "%.*e", p - 1, x);
    if (strtod(buf, NULL) == x) break;
  }
  char digits[24];
  int k = 0;
  const char *c = buf;
  if (*c == '-') { *out++ = '-'; c++; }
  for (; *c && *c != 'e'; c++) if (*c != '.') digits[k++] = *c;
  int n = atoi(c + 1) + 1; /* position of the decimal point */
  if (n > 0 && n <= 21) {
    for (int i = 0; i < k; i++) { if (i == n) *out++ = '.'; *out++ = digits[i]; }
    for (int i = k; i < n; i++) *out++ = '0';
    *out = 0;
  } else if (n > -6 && n <= 0) {
    *out++ = '0'; *out++ = '.';
    for (int i = 0; i < -n; i++) *out++ = '0';
    for (int i = 0; i < k; i++) *out++ = digits[i];
    *out = 0;
  } else {
    *out++ = digits[0];
    if (k > 1) { *out++ = '.'; for (int i = 1; i < k; i++) *out++ = digits[i]; }
    snprintf(out, 16, "e%c%d", n - 1 < 0 ? '-' : '+', abs(n - 1));
  }
}
static const vstr *vstr_from_i64(int64_t v) {
  char buf[32];
  snprintf(buf, sizeof buf, "%lld", (long long)v);
  return vstr_from_buf(buf);
}
static const vstr *vstr_from_f64(double v) {
  char buf[64];
  vfmt_f64(v, buf);
  return vstr_from_buf(buf);
}
static const vstr *vstr_from_bool(bool v) { return vstr_from_buf(v ? "true" : "false"); }

/* ---- io capability ---- */
static int vp_count;
static inline void vp_sep(void) { if (vp_count++) fputc(' ', stdout); }
static void vp_i64(int64_t v) { vp_sep(); printf("%lld", (long long)v); }
static void vp_f64(double v) { char buf[64]; vp_sep(); vfmt_f64(v, buf); fputs(buf, stdout); }
static void vp_bool(bool v) { vp_sep(); fputs(v ? "true" : "false", stdout); }
static void vp_str(const vstr *s) { vp_sep(); fwrite(s->data, 1, (size_t)s->len, stdout); }
static void vp_end(void) { fputc('\n', stdout); vp_count = 0; }

/* ---- time capability ---- */
static double avisoq_now_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1.0e6;
}

/* ---- lanes: pure code evaluated for 8 values at once ----
   Every lane-varying value is a vector; control flow becomes a mask of active lanes.
   Checks are gated by the mask, so a lane that is not executing can never trap. */
typedef int64_t vi __attribute__((vector_size(64)));
typedef uint64_t vu __attribute__((vector_size(64)));
typedef double vd __attribute__((vector_size(64)));
#define VI(x) ((vi){ (x), (x), (x), (x), (x), (x), (x), (x) })
#define VD(x) ((vd){ (x), (x), (x), (x), (x), (x), (x), (x) })
#define VB(x) VI((x) ? INT64_C(-1) : INT64_C(0))
#define VSELI(m, a, b) (((a) & (m)) | ((b) & ~(m)))
#define VSELD(m, a, b) ((vd)((((vi)(a)) & (m)) | (((vi)(b)) & ~(m))))
static const vi VLANES = { 0, 1, 2, 3, 4, 5, 6, 7 };
#ifdef __AVX512F__
#include <immintrin.h>
static inline bool vany(vi m) { return _mm512_test_epi64_mask((__m512i)m, (__m512i)m) != 0; }
#else
static inline bool vany(vi m) { return (m[0] | m[1] | m[2] | m[3] | m[4] | m[5] | m[6] | m[7]) != 0; }
#endif
#define VCHECK(m, site) do { if (VUNLIKELY(vany(m))) avisoq_fail(site); } while (0)
static inline vd vsqrtv(vd x) { vd r; for (int i = 0; i < 8; i++) r[i] = sqrt(x[i]); return r; }
static inline __int128 vhsum(vi r) {
  return (__int128)r[0] + r[1] + r[2] + r[3] + r[4] + r[5] + r[6] + r[7];
}

static void avisoq_init(void) {
#ifndef AVISOQ_SHARED
#ifdef _WIN32
  _setmode(_fileno(stdout), _O_BINARY);
#endif
  setvbuf(stdout, NULL, _IOFBF, 1 << 16);
#endif
  for (int i = 0; i < 256; i++) {
    VCHR[i] = (vstr *)malloc(sizeof(vstr) + 2);
    VCHR[i]->len = 1;
    VCHR[i]->data[0] = (char)i;
    VCHR[i]->data[1] = 0;
  }
}

#ifdef AVISOQ_SHARED
/* ---- calling from another language ----
   Arguments and results cross as bytes, little-endian, in this layout:
     Int, Float  8 bytes        Bool  1 byte        Str  length (8 bytes) then the bytes
     [T]  count (8 bytes) then each element        struct, tuple  the fields in order
     enum  variant number (8 bytes) then that variant's fields */
typedef struct { const uint8_t *p, *end; } vrd;
static inline void vrd_take(vrd *r, void *to, int64_t n) {
  if (VUNLIKELY(n < 0 || (int64_t)(r->end - r->p) < n)) avisoq_fail(VSITE_WIRE);
  memcpy(to, r->p, (size_t)n);
  r->p += n;
}
/* A count of things that each take at least `each` bytes: it cannot exceed what is left. */
static inline int64_t vrd_count(vrd *r, int64_t each) {
  int64_t n;
  vrd_take(r, &n, 8);
  if (VUNLIKELY(n < 0 || n > VMAX_ARRAY_LEN || (each > 0 && n > (int64_t)(r->end - r->p) / each))) avisoq_fail(VSITE_WIRE);
  return n;
}
static uint8_t *vwr_buf = NULL;
static int64_t vwr_len = 0, vwr_cap = 0;
static void vwr_put(const void *from, int64_t n) {
  if (VUNLIKELY(vwr_len + n > vwr_cap)) {
    int64_t cap = vwr_cap ? vwr_cap : 256;
    while (cap < vwr_len + n) cap *= 2;
    uint8_t *b = (uint8_t *)realloc(vwr_buf, (size_t)cap);
    if (VUNLIKELY(!b)) avisoq_fail(VSITE_OOM);
    vwr_buf = b;
    vwr_cap = cap;
  }
  memcpy(vwr_buf + vwr_len, from, (size_t)n);
  vwr_len += n;
}
static inline int64_t rd_Int(vrd *r) { int64_t v; vrd_take(r, &v, 8); return v; }
static inline double rd_Float(vrd *r) { double v; vrd_take(r, &v, 8); return v; }
static inline bool rd_Bool(vrd *r) { uint8_t v; vrd_take(r, &v, 1); return v != 0; }
static const vstr *rd_Str(vrd *r) {
  int64_t n = vrd_count(r, 1);
  vstr *s = vstr_new(n);
  vrd_take(r, s->data, n);
  return s;
}
static inline void wr_Int(int64_t v) { vwr_put(&v, 8); }
static inline void wr_Float(double v) { vwr_put(&v, 8); }
static inline void wr_Bool(bool v) { uint8_t b = v ? 1 : 0; vwr_put(&b, 1); }
static void wr_Str(const vstr *v) { vwr_put(&v->len, 8); vwr_put(v->data, v->len); }
#endif
