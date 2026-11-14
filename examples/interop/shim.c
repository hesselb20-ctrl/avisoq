/* C functions for native.avq. An extern function exchanges only these types with Avisoq:
     Int  <->  long long        Float  <->  double
     Bool <->  bool             Str    <->  const char*  (zero-terminated; a returned string is copied)
   Anything else a C library needs (pointers, handles, structs) stays on this side. */
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

long long add_squares(long long a, long long b) { return a * a + b * b; }

double half(double x) { return x / 2.0; }

bool is_palindrome(const char *s) {
  size_t n = strlen(s);
  for (size_t i = 0; i < n / 2; i++) if (s[i] != s[n - 1 - i]) return false;
  return true;
}

/* A returned string must stay valid until the call returns; a static buffer is the simple way. */
const char *describe(const char *name, long long n, double ratio, bool on) {
  static char buffer[256];
  snprintf(buffer, sizeof buffer, "%s:%lld:%.2f:%s", name, n, ratio, on ? "on" : "off");
  return buffer;
}

static long long counter = 0;
void bump(long long by) { counter += by; }
long long current(void) { return counter; }

const char *nothing(void) { return NULL; }
