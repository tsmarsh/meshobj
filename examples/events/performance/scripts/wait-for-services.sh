#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

MAX_RETRIES=30
RETRY_DELAY=2

# Check if service is responding
check_service() {
    local url=$1
    local name=$2

    for i in $(seq 1 $MAX_RETRIES); do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $name is ready${NC}"
            return 0
        fi

        if [ $i -eq 1 ]; then
            echo -e "${YELLOW}⏳ Waiting for $name...${NC}"
        fi

        sleep $RETRY_DELAY
    done

    echo -e "${RED}✗ $name failed to become ready${NC}"
    return 1
}

# Check all services
echo "Checking Events service health..."

# Events service health endpoint
if ! check_service "http://localhost:4055/ready" "Events service"; then
    echo -e "${RED}Events service is not responding${NC}"
    exit 1
fi

# Kafka (check if we can list topics)
echo -e "${YELLOW}⏳ Checking Kafka...${NC}"
if docker exec -it $(docker ps -q -f name=kafka) kafka-topics --bootstrap-server localhost:9093 --list > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Kafka is ready${NC}"
else
    echo -e "${RED}✗ Kafka is not ready${NC}"
    echo -e "${YELLOW}Note: Some tests may not work without Kafka${NC}"
fi

echo -e "${GREEN}All services are ready!${NC}"
exit 0
