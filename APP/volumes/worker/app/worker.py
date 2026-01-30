import time

def main():
    while True:
        print("[worker] alive")
        time.sleep(10)

if __name__ == "__main__":
    main()