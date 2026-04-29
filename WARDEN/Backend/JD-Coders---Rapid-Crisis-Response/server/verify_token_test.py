from jose import jwt
SECRET_KEY = "jadoo"
ALGORITHM = "HS256"
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InNpbS1pZC0wMDEiLCJ1c2VybmFtZSI6InNpbXVsYXRpb25fZW5naW5lIiwicm9sZSI6InN0YWZmIiwic3RhZmZfcm9sZSI6ImFkbWluIiwiZXhwIjoxNzg0MDE2Mjc1fQ.u-faHhqtOCJ9a8DnGhTYfsiYy8DmFaKCr-n16BSt-ZE"
try:
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    print(decoded)
except Exception as e:
    print(e)
