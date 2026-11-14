/* Runs a compiled Avisoq program with reduced rights on Windows.
 *
 *   avisoq-sandbox <low|std> <memory limit in MB, or 0> <program> [args...]
 *
 * Always: the program runs in a job object that forbids child processes, blocks access to
 * the desktop, clipboard and system settings, and dies with this launcher; its token has
 * every privilege removed.
 * In "low" mode (used when the program was granted neither files nor network) the token is
 * also dropped to low integrity, so it cannot write to any normal file or registry key.
 * No system setting or file permission is changed. */
#define _WIN32_WINNT 0x0602
#include <windows.h>
#include <sddl.h>
#include <stdio.h>
#include <stdlib.h>
#include <wchar.h>

/* Appends one argument, quoted the way CommandLineToArgvW expects. */
static void append_arg(wchar_t **out, const wchar_t *arg) {
  wchar_t *p = *out;
  *p++ = L'"';
  for (const wchar_t *c = arg;; c++) {
    int slashes = 0;
    while (*c == L'\\') { c++; slashes++; }
    if (*c == 0) { for (int i = 0; i < slashes * 2; i++) *p++ = L'\\'; break; }
    if (*c == L'"') { for (int i = 0; i < slashes * 2 + 1; i++) *p++ = L'\\'; *p++ = L'"'; }
    else { for (int i = 0; i < slashes; i++) *p++ = L'\\'; *p++ = *c; }
  }
  *p++ = L'"';
  *p++ = L' ';
  *out = p;
}

int wmain(int argc, wchar_t **argv) {
  if (argc < 4) { fwprintf(stderr, L"usage: avisoq-sandbox <low|std> <memoryMB> <program> [args...]\n"); return 64; }
  BOOL low = wcscmp(argv[1], L"low") == 0;
  SIZE_T memMb = (SIZE_T)_wtoi(argv[2]);

  HANDLE job = CreateJobObjectW(NULL, NULL);
  if (!job) return 70;
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION li;
  ZeroMemory(&li, sizeof li);
  li.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS | JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION;
  li.BasicLimitInformation.ActiveProcessLimit = 1;
  if (memMb) { li.BasicLimitInformation.LimitFlags |= JOB_OBJECT_LIMIT_JOB_MEMORY; li.JobMemoryLimit = memMb << 20; }
  if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, &li, sizeof li)) return 70;
  JOBOBJECT_BASIC_UI_RESTRICTIONS ui;
  ui.UIRestrictionsClass = JOB_OBJECT_UILIMIT_ALL;
  SetInformationJobObject(job, JobObjectBasicUIRestrictions, &ui, sizeof ui);

  HANDLE token = NULL, restricted = NULL;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_ALL_ACCESS, &token)) return 71;
  if (!CreateRestrictedToken(token, DISABLE_MAX_PRIVILEGE, 0, NULL, 0, NULL, 0, NULL, &restricted)) return 71;
  if (low) {
    PSID sid = NULL;
    if (!ConvertStringSidToSidW(L"S-1-16-4096", &sid)) return 72;
    TOKEN_MANDATORY_LABEL label;
    ZeroMemory(&label, sizeof label);
    label.Label.Attributes = SE_GROUP_INTEGRITY;
    label.Label.Sid = sid;
    if (!SetTokenInformation(restricted, TokenIntegrityLevel, &label, sizeof label + GetLengthSid(sid))) return 72;
  }

  size_t total = 16;
  for (int i = 3; i < argc; i++) total += wcslen(argv[i]) * 2 + 8;
  wchar_t *cmd = (wchar_t *)malloc(total * sizeof(wchar_t)), *end = cmd;
  for (int i = 3; i < argc; i++) append_arg(&end, argv[i]);
  *end = 0;

  STARTUPINFOW si;
  PROCESS_INFORMATION pi;
  ZeroMemory(&si, sizeof si);
  si.cb = sizeof si;
  si.dwFlags = STARTF_USESTDHANDLES;
  si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
  si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
  si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
  if (!CreateProcessAsUserW(restricted, argv[3], cmd, NULL, NULL, TRUE, CREATE_SUSPENDED, NULL, NULL, &si, &pi)) {
    fwprintf(stderr, L"avisoq-sandbox: could not start the program (error %lu)\n", GetLastError());
    return 73;
  }
  if (!AssignProcessToJobObject(job, pi.hProcess)) { TerminateProcess(pi.hProcess, 74); return 74; }
  ResumeThread(pi.hThread);
  WaitForSingleObject(pi.hProcess, INFINITE);
  DWORD code = 0;
  GetExitCodeProcess(pi.hProcess, &code);
  return (int)code;
}
