/* Vow native runtime. Included into every generated program (single translation unit).
   The generated code defines vow_sites[] before this text. */
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
enum { VSITE_OOM = 0, VSITE_DIV_OVERFLOW = 1, VSITE_FLOAT_RANGE = 2, VSITE_FS_DENIED = 3 };

__attribute__((noreturn, cold, noinline)) static void vow_fail(int site) {
#pragma omp critical(vow_fail_lock)
  {
    fflush(stdout);
    fprintf(stderr, "\001VOWFAIL %s\n", vow_sites[site]);
    fflush(stderr);
    _Exit(3);
  }
  __builtin_unreachable();
}

/* ---- memory: thread-local region allocator ----
   Small blocks are bump-allocated from 1 MB chunks; large blocks come from malloc and are
   linked so they can be returned. vow_mark() / vow_reset() bracket a region: the compiler
   inserts them where it has proved that nothing allocated inside can still be reachable. */
#define VARENA_CHUNK (1 << 20)
struct vmap;
typedef struct vbig { struct vbig *older; int64_t pad; } vbig;
typedef struct { char *p; char *end; int64_t chunk; vbig *big; struct vmap *maps; } vmark;
typedef struct { vmark cur; char **chunks; int64_t nchunks; } vtls;
static _Thread_local vtls VT = { { NULL, NULL, -1, NULL, NULL }, NULL, 0 };
static void vmap_release(struct vmap *m);
static struct vmap *vmap_older(struct vmap *m);

static void *vow_alloc(size_t n, bool zeroed) {
  vtls *t = &VT;
  n = (n + 15) & ~(size_t)15;
  if (n > 65536) {
    vbig *big = (vbig *)(zeroed ? calloc(1, n + sizeof(vbig)) : malloc(n + sizeof(vbig)));
    if (VUNLIKELY(!big)) vow_fail(VSITE_OOM);
    big->older = t->cur.big;
    t->cur.big = big;
    return big + 1;
  }
  if (VUNLIKELY((size_t)(t->cur.end - t->cur.p) < n)) {
    t->cur.chunk++;
    if (t->cur.chunk >= t->nchunks) {
      t->chunks = (char **)realloc(t->chunks, sizeof(char *) * (size_t)(t->nchunks + 1));
      if (VUNLIKELY(!t->chunks)) vow_fail(VSITE_OOM);
      t->chunks[t->nchunks] = (char *)malloc(VARENA_CHUNK);
      if (VUNLIKELY(!t->chunks[t->nchunks])) vow_fail(VSITE_OOM);
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

static inline vmark vow_mark(void) { return VT.cur; }

static void vow_reset(vmark m) {
  vtls *t = &VT;
  while (t->cur.big != m.big) {
    vbig *b = t->cur.big;
    t->cur.big = b->older;
    free(b);
  }
  while (t->cur.maps != m.maps) {
    struct vmap *mp = t->cur.maps;
    t->cur.maps = vmap_older(mp);
    vmap_release(mp);
  }
  t->cur = m;
}

/* ---- arrays: 16-byte header, elements follow ---- */
typedef struct { int64_t len; int64_t pad; } varr;
#define VDATA(T, a) ((T *)((a) + 1))

static varr *vow_arr_alloc(int64_t n, size_t elem, int site, bool zeroed) {
  if (VUNLIKELY((uint64_t)n > (uint64_t)VMAX_ARRAY_LEN)) vow_fail(site);
  varr *a = (varr *)vow_alloc(sizeof(varr) + (size_t)n * elem, zeroed);
  a->len = n;
  a->pad = 0;
  return a;
}

/* ---- checked arithmetic ---- */
static inline int64_t vadd(int64_t a, int64_t b, int site) {
  int64_t r;
  if (VUNLIKELY(__builtin_add_overflow(a, b, &r))) vow_fail(site);
  return r;
}
static inline int64_t vsub(int64_t a, int64_t b, int site) {
  int64_t r;
  if (VUNLIKELY(__builtin_sub_overflow(a, b, &r))) vow_fail(site);
  return r;
}
static inline int64_t vmul(int64_t a, int64_t b, int site) {
  int64_t r;
  if (VUNLIKELY(__builtin_mul_overflow(a, b, &r))) vow_fail(site);
  return r;
}
/* Multiply by a constant c >= 1. The range test runs beside the multiply instead of after it. */
static inline int64_t vmulc(int64_t x, int64_t c, int site) {
  if (VUNLIKELY(x > INT64_MAX / c || x < INT64_MIN / c)) vow_fail(site);
  return (int64_t)((uint64_t)x * (uint64_t)c);
}
static inline int64_t vwadd(int64_t a, int64_t b) { return (int64_t)((uint64_t)a + (uint64_t)b); }
static inline int64_t vwsub(int64_t a, int64_t b) { return (int64_t)((uint64_t)a - (uint64_t)b); }
static inline int64_t vwmul(int64_t a, int64_t b) { return (int64_t)((uint64_t)a * (uint64_t)b); }
static inline int64_t vdiv(int64_t a, int64_t b, int site) {
  if (VUNLIKELY(b == 0)) vow_fail(site);
  if (VUNLIKELY(b == -1 && a == INT64_MIN)) vow_fail(VSITE_DIV_OVERFLOW);
  return a / b;
}
static inline int64_t vmod(int64_t a, int64_t b, int site) {
  if (VUNLIKELY(b == 0)) vow_fail(site);
  if (VUNLIKELY(b == -1)) return 0;
  return a % b;
}
static inline int64_t vf2i(double x) {
  if (VUNLIKELY(!(x > -9223372036854777856.0 && x < 9223372036854775808.0))) vow_fail(VSITE_FLOAT_RANGE);
  return (int64_t)x;
}

/* ---- strings: immutable, length-prefixed UTF-8 ---- */
typedef struct { int64_t len; char data[]; } vstr;

static vstr *vstr_new(int64_t len) {
  vstr *s = (vstr *)vow_alloc(sizeof(vstr) + (size_t)len + 1, false);
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
static const vstr *vstr_substr(const vstr *s, int64_t start, int64_t end, int site) {
  if (VUNLIKELY(start < 0 || end < start || end > s->len)) vow_fail(site);
  vstr *r = vstr_new(end - start);
  memcpy(r->data, s->data + start, (size_t)(end - start));
  return r;
}
static int64_t vstr_byte_at(const vstr *s, int64_t i, int site) {
  if (VUNLIKELY((uint64_t)i >= (uint64_t)s->len)) vow_fail(site);
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
static void vmap_release(struct vmap *m) { free(m->slots); free(m->keys); free(m->vals); }

static vmap *vmap_new(int64_t vsize, int strkeys) {
  vmap *m = (vmap *)vow_alloc(sizeof(vmap), true);
  m->vsize = vsize;
  m->strkeys = strkeys;
  m->older = VT.cur.maps;
  VT.cur.maps = m;
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
    if (VUNLIKELY(cap > (INT64_C(1) << 30))) vow_fail(VSITE_OOM);
    m->keys = (uint64_t *)realloc(m->keys, (size_t)cap * sizeof(uint64_t));
    m->vals = (char *)realloc(m->vals, (size_t)(cap * m->vsize));
    free(m->slots);
    m->nslots = cap * 2;
    m->slots = (int32_t *)calloc((size_t)m->nslots, sizeof(int32_t));
    if (VUNLIKELY(!m->keys || !m->vals || !m->slots)) vow_fail(VSITE_OOM);
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
  if (VUNLIKELY(idx < 0)) vow_fail(site);
  return m->vals + idx * m->vsize;
}
static varr *vmap_keys(const vmap *m, int site) {
  varr *a = vow_arr_alloc(m->len, sizeof(uint64_t), site, false);
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
static bool vow_path_ok(const vstr *path, char *full) {
#ifdef _WIN32
  if (!_fullpath(full, path->data, 4096)) return false;
#else
  if (!realpath(path->data, full)) { if (path->len >= 4096) return false; memcpy(full, path->data, (size_t)path->len + 1); }
#endif
  if (vow_fs_any) return true;
  for (int i = 0; vow_fs_roots[i]; i++) {
    size_t n = strlen(vow_fs_roots[i]);
#ifdef _WIN32
    if (_strnicmp(full, vow_fs_roots[i], n) != 0) continue;
#else
    if (strncmp(full, vow_fs_roots[i], n) != 0) continue;
#endif
    if (full[n] == 0 || full[n] == '\\' || full[n] == '/') return true;
  }
  return false;
}
static const vstr *vow_read_file(const vstr *path, int site) {
  char full[4096];
  if (!vow_path_ok(path, full)) vow_fail(VSITE_FS_DENIED);
  FILE *f = fopen(full, "rb");
  if (!f) vow_fail(site);
  fseek(f, 0, SEEK_END);
  long n = ftell(f);
  fseek(f, 0, SEEK_SET);
  if (n < 0) { fclose(f); vow_fail(site); }
  vstr *s = vstr_new((int64_t)n);
  size_t got = fread(s->data, 1, (size_t)n, f);
  fclose(f);
  if (got != (size_t)n) vow_fail(site);
  return s;
}
static void vow_write_file(const vstr *path, const vstr *content, int site) {
  char full[4096];
  if (!vow_path_ok(path, full)) vow_fail(VSITE_FS_DENIED);
  FILE *f = fopen(full, "wb");
  if (!f) vow_fail(site);
  size_t put = fwrite(content->data, 1, (size_t)content->len, f);
  if (fclose(f) != 0 || put != (size_t)content->len) vow_fail(site);
}
static bool vow_file_exists(const vstr *path) {
  char full[4096];
  if (!vow_path_ok(path, full)) vow_fail(VSITE_FS_DENIED);
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
static double vow_now_ms(void) {
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
#define VCHECK(m, site) do { if (VUNLIKELY(vany(m))) vow_fail(site); } while (0)
static inline vd vsqrtv(vd x) { vd r; for (int i = 0; i < 8; i++) r[i] = sqrt(x[i]); return r; }
static inline __int128 vhsum(vi r) {
  return (__int128)r[0] + r[1] + r[2] + r[3] + r[4] + r[5] + r[6] + r[7];
}

static void vow_init(void) {
#ifdef _WIN32
  _setmode(_fileno(stdout), _O_BINARY);
#endif
  setvbuf(stdout, NULL, _IOFBF, 1 << 16);
}
