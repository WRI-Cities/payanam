FROM python:3.9-slim-buster
EXPOSE 5050
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip3 install -r requirements.txt
COPY . .
CMD ["python", "launch.py"]