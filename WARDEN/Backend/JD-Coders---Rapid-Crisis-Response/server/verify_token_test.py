from jose import jwt
from core.config import settings

ALGORITHM = settings.ALGORITHM
token = "<YOUR_JWT_TOKEN>"
try:
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    print(decoded)
except Exception as e:
    print(e)
