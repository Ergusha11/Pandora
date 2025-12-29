import os
from sec_edgar_downloader import Downloader
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv(dotenv_path="../.env")

def download_sec_filings(tickers, limit=1):
    email = os.getenv("SEC_EMAIL")
    if not email:
        raise ValueError("Necesitas definir SEC_EMAIL en el archivo .env")

    # Guardaremos los datos en la carpeta compartida 'data'
    save_path = os.path.join("..", "data", "raw_pdfs")
    
    # Inicializar el descargador
    dl = Downloader("MyFinancialApp", email, save_path)

    for ticker in tickers:
        print(f"📥 Descargando últimos {limit} reportes 10-K para {ticker}...")
        try:
            # Descarga reportes anuales (10-K)
            dl.get("10-K", ticker, limit=limit)
            print(f"✅ Descarga completada para {ticker}")
        except Exception as e:
            print(f"❌ Error descargando {ticker}: {e}")

if __name__ == "__main__":
    # Puedes editar esta lista
    mis_acciones = ["AAPL", "NVDA", "AVGO"] 
    download_sec_filings(mis_acciones)
