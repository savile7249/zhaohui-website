#!/usr/bin/env python3
"""Generate local test CA and server TLS certificates for isolated *.localhost verification."""

import argparse
import datetime
import ipaddress
import os
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


def ensure_ca(certs_dir: Path):
    ca_cert_path = certs_dir / "local-ca.pem"
    ca_key_path = certs_dir / "local-ca.key"
    if ca_cert_path.is_file() and ca_key_path.is_file():
        ca_key = serialization.load_pem_private_key(ca_key_path.read_bytes(), password=None)
        ca_cert = x509.load_pem_x509_certificate(ca_cert_path.read_bytes())
        return ca_key, ca_cert

    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Zhaohui Local Test CA")])
    now = datetime.datetime.now(datetime.timezone.utc)
    ca_cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(ca_key, hashes.SHA256())
    )
    ca_key_path.write_bytes(
        ca_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )
    )
    os.chmod(ca_key_path, 0o600)
    ca_cert_path.write_bytes(ca_cert.public_bytes(serialization.Encoding.PEM))
    return ca_key, ca_cert


def issue_server_cert(certs_dir: Path, days: int, prefix: str = "server"):
    ca_key, ca_cert = ensure_ca(certs_dir)
    srv_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    now = datetime.datetime.now(datetime.timezone.utc)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "jszhff.localhost")])
    san = x509.SubjectAlternativeName(
        [
            x509.DNSName("localhost"),
            x509.DNSName("*.localhost"),
            x509.DNSName("jszhff.localhost"),
            x509.DNSName("zhaohuifangfu.localhost"),
            x509.DNSName("sim-site.localhost"),
            x509.DNSName("preview-jszhff.localhost"),
            x509.DNSName("preview-zhaohuifangfu.localhost"),
            x509.DNSName("preview-sim-site.localhost"),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
        ]
    )
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(ca_cert.subject)
        .public_key(srv_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=days))
        .add_extension(san, critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .sign(ca_key, hashes.SHA256())
    )
    key_path = certs_dir / f"{prefix}.key"
    cert_path = certs_dir / f"{prefix}.crt"
    key_path.write_bytes(
        srv_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )
    )
    os.chmod(key_path, 0o600)
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return cert_path, key_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--certs-dir", required=True)
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--prefix", default="server")
    args = parser.parse_args()
    cdir = Path(args.certs_dir)
    cdir.mkdir(parents=True, exist_ok=True)
    cert_path, key_path = issue_server_cert(cdir, days=args.days, prefix=args.prefix)
    print(f"Generated TLS cert ({args.days}d): {cert_path} & {key_path}")


if __name__ == "__main__":
    main()
