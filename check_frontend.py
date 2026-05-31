import urllib.request, json

BASE_FRONTEND = 'http://localhost:5174'
BASE_BACKEND  = 'http://localhost:8001'

results = []

def check(label, url, expect_status=200):
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            ok = r.status == expect_status
            results.append((label, 'OK' if ok else 'WRONG_STATUS', str(r.status)))
    except Exception as e:
        results.append((label, 'FAIL', str(e)[:60]))

# Frontend pages
check('Frontend /           (Upload page)',    BASE_FRONTEND + '/')
check('Frontend /editor     (Editor page)',    BASE_FRONTEND + '/editor')
check('Frontend /test-studio (Test Studio)',   BASE_FRONTEND + '/test-studio')

# Backend via frontend proxy (Vite proxies these)
check('Proxy GET /health',          BASE_FRONTEND + '/health')
check('Proxy GET /api/files',       BASE_FRONTEND + '/api/files')
check('Proxy GET /api/subprograms', BASE_FRONTEND + '/api/subprograms')
check('Proxy GET /api/export',      BASE_FRONTEND + '/api/export')

# Direct backend
check('Backend GET /health',        BASE_BACKEND + '/health')
check('Backend GET /api/files',     BASE_BACKEND + '/api/files')
check('Backend GET /api/subprograms', BASE_BACKEND + '/api/subprograms')

print('FRONTEND + PROXY CHECK:')
print('-' * 65)
for label, status, detail in results:
    icon = '[OK]  ' if status == 'OK' else '[FAIL]'
    print(icon + ' ' + label + ' -> ' + detail)

ok_count = sum(1 for _, s, _ in results if s == 'OK')
print('-' * 65)
print('Result: ' + str(ok_count) + '/' + str(len(results)) + ' checks OK')
