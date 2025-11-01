#!/bin/bash
# k6 CDC Latency Test
# Posts events via k6, then measures CDC pipeline latency

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== k6 CDC Pipeline Latency Test ===${NC}"
echo ""

# Check if k6 is available
if [ ! -f "$PERF_DIR/k6" ]; then
    echo -e "${RED}Error: k6 binary not found at $PERF_DIR/k6${NC}"
    echo "Please build k6 with Kafka extension first:"
    echo "  xk6 build --with github.com/mostafa/xk6-kafka@latest"
    exit 1
fi

# Run k6 test
echo -e "${YELLOW}Step 1: Posting events via k6...${NC}"
cd "$PERF_DIR"
./k6 run --vus 1 --iterations 100 cdc-latency-kafka.k6.js

echo ""
echo -e "${YELLOW}Step 2: Measuring CDC pipeline latency...${NC}"
sleep 2  # Give CDC pipeline time to process

# Run the measurement script
bash "$SCRIPT_DIR/measure-cdc-latency.sh"
