import os
import io
import time
import json
import zipfile
import requests
from pathlib import Path

# Configuration
BASE_URL = 'http://127.0.0.1:8000/api/'
USERNAME = os.getenv('TEST_USER', 'testuser123')
PASSWORD = os.getenv('TEST_PASS', 'testpassword123')

# Helper to obtain auth token (assuming token auth endpoint exists)
def get_token():
    # Attempt to register first in case the user does not exist
    try:
        requests.post(BASE_URL + 'register/', json={'username': USERNAME, 'password': PASSWORD})
    except Exception:
        pass
        
    # Corrected endpoint is 'token/' instead of 'auth/token/'
    resp = requests.post(BASE_URL + 'token/', json={'username': USERNAME, 'password': PASSWORD})
    if resp.status_code == 200:
        return resp.json().get('access')
    return None

def main():
    token = get_token()
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'

    # 1. Create a project (if not existing)
    project_data = {'title': 'Goal Test Project', 'description': 'Goal verification'}
    resp = requests.post(BASE_URL + 'projects/', json=project_data, headers=headers)
    if resp.status_code not in (200, 201):
        print('Failed to create project', resp.status_code, resp.text)
        return
    project = resp.json()
    project_id = project['id']
    print('Created project', project_id)

    # 2. Create a zip file in memory
    img_bytes = io.BytesIO()
    # simple binary placeholder for image
    img_bytes.write(b'PNGDATA')
    img_bytes.seek(0)
    zip_bytes = io.BytesIO()
    with zipfile.ZipFile(zip_bytes, 'w') as zf:
        zf.writestr('test_image.png', img_bytes.read())
        zf.writestr('readme.txt', 'test')
    zip_bytes.seek(0)

    # Write zip to temp file for curl upload
    tmp_path = Path('temp_test_archive.zip')
    with open(tmp_path, 'wb') as f:
        f.write(zip_bytes.read())

    # 3. Upload archive via API
    files = {'zip_file': open(tmp_path, 'rb')}
    data = {'project': str(project_id)}
    resp = requests.post(BASE_URL + 'archives/', files=files, data=data, headers=headers)
    files['zip_file'].close()
    tmp_path.unlink()
    if resp.status_code not in (200, 201, 202):
        print('Upload failed', resp.status_code, resp.text)
        return
    print('Archive uploaded')

    # 4. Poll project until project_feedback appears
    for _ in range(30):
        resp = requests.get(BASE_URL + f'projects/{project_id}/', headers=headers)
        if resp.status_code != 200:
            print('Failed to fetch project', resp.status_code)
            return
        proj = resp.json()
        if proj.get('project_feedback'):
            print('Project feedback ready')
            break
        time.sleep(5)
    else:
        print('Timeout waiting for feedback')
        return

    # 5. Download PDF report
    resp = requests.get(BASE_URL + f'projects/{project_id}/report/', headers=headers, stream=True)
    if resp.status_code == 200:
        pdf_content = resp.content
        print('PDF downloaded, size', len(pdf_content))
    else:
        print('PDF download failed', resp.status_code)

if __name__ == '__main__':
    main()
