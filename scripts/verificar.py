#!/usr/bin/env python3
"""Prueba real de S3, SQS y DynamoDB; conserva evidencia y elimina sus recursos temporales."""
import datetime
import json
import pathlib
import subprocess
import sys
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
AWS = ROOT / "scripts" / "awslocal"
DESTINO = ROOT / "evidencias" / "00-entorno" / "verificacion.json"


def aws(*args):
    result = subprocess.run(
        [str(AWS), *args, "--output", "json"],
        check=True, text=True, capture_output=True, timeout=60,
    )
    return json.loads(result.stdout) if result.stdout.strip() else {}


def main():
    report = {
        "fecha": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "entorno": "LocalStack en Docker/OrbStack; ejecución local",
        "endpoint": "http://127.0.0.1:4566",
        "region": "us-east-1",
        "pruebas": {}, "limpieza": {}, "resultado": "PENDIENTE",
    }
    suffix = uuid.uuid4().hex[:12]
    bucket, queue_name, table = (f"taller-check-{suffix}-{s}" for s in ("s3", "sqs", "ddb"))
    cleanup = []
    try:
        with urllib.request.urlopen(report["endpoint"] + "/_localstack/health", timeout=10) as response:
            health = json.load(response)
        report["localstack"] = {k: health[k] for k in ("edition", "version") if k in health}
        report["servicios"] = health.get("services", {})

        aws("s3api", "create-bucket", "--bucket", bucket)
        cleanup.append(("S3 bucket", ("s3api", "delete-bucket", "--bucket", bucket)))
        source = DESTINO.parent / "prueba-s3.txt"
        downloaded = DESTINO.parent / "prueba-s3-descargada.txt"
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text("Prueba real del entorno local del taller.\n", encoding="utf-8")
        aws("s3api", "put-object", "--bucket", bucket, "--key", "prueba.txt", "--body", str(source))
        cleanup.append(("S3 objeto", ("s3api", "delete-object", "--bucket", bucket, "--key", "prueba.txt")))
        aws("s3api", "get-object", "--bucket", bucket, "--key", "prueba.txt", str(downloaded))
        if downloaded.read_bytes() != source.read_bytes():
            raise RuntimeError("El archivo descargado de S3 no coincide con el original")
        report["pruebas"]["S3"] = "OK: bucket, carga y descarga con contenido idéntico"

        queue = aws("sqs", "create-queue", "--queue-name", queue_name)["QueueUrl"]
        cleanup.append(("SQS", ("sqs", "delete-queue", "--queue-url", queue)))
        aws("sqs", "send-message", "--queue-url", queue, "--message-body", suffix)
        messages = aws("sqs", "receive-message", "--queue-url", queue, "--wait-time-seconds", "2")
        if not any(m.get("Body") == suffix for m in messages.get("Messages", [])):
            raise RuntimeError("SQS no devolvió el mensaje esperado")
        report["pruebas"]["SQS"] = "OK: creación de cola, envío y recepción del mensaje"

        aws("dynamodb", "create-table", "--table-name", table,
            "--attribute-definitions", "AttributeName=id,AttributeType=S",
            "--key-schema", "AttributeName=id,KeyType=HASH", "--billing-mode", "PAY_PER_REQUEST")
        cleanup.append(("DynamoDB", ("dynamodb", "delete-table", "--table-name", table)))
        aws("dynamodb", "wait", "table-exists", "--table-name", table)
        item = {"id": {"S": suffix}, "estado": {"S": "listo"}}
        aws("dynamodb", "put-item", "--table-name", table, "--item", json.dumps(item))
        found = aws("dynamodb", "get-item", "--table-name", table,
                    "--key", json.dumps({"id": {"S": suffix}}), "--consistent-read")
        if found.get("Item") != item:
            raise RuntimeError("DynamoDB no devolvió el registro esperado")
        report["pruebas"]["DynamoDB"] = "OK: creación de tabla, escritura y lectura del registro"
        report["resultado"] = "OK"
    except Exception as exc:
        report["resultado"] = "ERROR"
        report["error"] = str(exc)
        if isinstance(exc, subprocess.CalledProcessError):
            report["detalle"] = exc.stderr.strip()
    finally:
        for label, args in reversed(cleanup):
            try:
                aws(*args)
                report["limpieza"][label] = "OK"
            except Exception as exc:
                report["limpieza"][label] = str(exc)
                report["resultado"] = "ERROR"
        DESTINO.parent.mkdir(parents=True, exist_ok=True)
        DESTINO.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\nEvidencia: {DESTINO}")
    return 0 if report["resultado"] == "OK" else 1


if __name__ == "__main__":
    sys.exit(main())
