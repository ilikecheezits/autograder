# Test solution to verify input handling
def solve():
    # Read first number (count)
    n = int(input())
    print(f"Read n: {n}")
    
    # Read each subsequent number
    for i in range(n):
        x = int(input())
        print(f"Read number {i+1}: {x}")

if __name__ == "__main__":
    solve() 