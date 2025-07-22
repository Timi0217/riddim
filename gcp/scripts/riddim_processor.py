#!/usr/bin/env python3
import os
import subprocess
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_environment():
    """Test if all tools are installed"""
    try:
        # Test yt-dlp
        subprocess.run(["yt-dlp", "--version"], check=True)
        logger.info("✅ yt-dlp is installed")
        
        # Test demucs
        subprocess.run(["python3", "-c", "import demucs"], check=True)
        logger.info("✅ demucs is installed")
        
        # Test CUDA
        subprocess.run(["nvidia-smi"], check=True)
        logger.info("✅ GPU is available")
        
        return True
    except Exception as e:
        logger.error(f"❌ Environment test failed: {e}")
        return False

def download_test_song():
    """Download one test song"""
    cmd = [
        "yt-dlp",
        "--extract-audio",
        "--audio-format", "wav",
        "--output", "test_song.%(ext)s",
        "ytsearch1:Rema Calm Down"
    ]
    
    try:
        logger.info("Downloading test song...")
        subprocess.run(cmd, check=True, timeout=300)
        logger.info("✅ Download successful")
        return True
    except Exception as e:
        logger.error(f"❌ Download failed: {e}")
        return False

def separate_test_stems():
    """Separate test song into stems"""
    cmd = [
        "python3", "-m", "demucs.separate",
        "--device", "cuda",
        "test_song.wav"
    ]
    
    try:
        logger.info("Separating stems...")
        subprocess.run(cmd, check=True, timeout=600)
        logger.info("✅ Stem separation successful")
        return True
    except Exception as e:
        logger.error(f"❌ Stem separation failed: {e}")
        return False

def main():
    logger.info("🎵 RIDDIM Processor Starting...")
    
    if test_environment():
        if download_test_song():
            if separate_test_stems():
                logger.info("🎉 All tests passed!")
            else:
                logger.error("Stem separation failed")
        else:
            logger.error("Download failed")
    else:
        logger.error("Environment setup failed")

if __name__ == "__main__":
    main()
