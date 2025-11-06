#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="meshobj-examples-events"
NAMESPACE="meshobj-examples-events"

# Environment selection: ci (ephemeral, fast) or dev (persistent)
# Default to ci for tests, use dev for local development
ENV="${1:-ci}"

if [[ "$ENV" != "ci" && "$ENV" != "dev" ]]; then
    echo "Error: Environment must be 'ci' or 'dev'"
    echo "Usage: $0 [ci|dev]"
    echo "  ci  - Ephemeral storage (emptyDir) - fast, for testing"
    echo "  dev - Persistent storage (PVC) - for local development"
    exit 1
fi

echo "Setting up kind cluster: $CLUSTER_NAME (environment: $ENV)"

# Check if cluster already exists
if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
    echo "Cluster $CLUSTER_NAME already exists. Deleting..."
    kind delete cluster --name "$CLUSTER_NAME"
fi

# Create kind cluster
echo "Creating kind cluster..."
kind create cluster --name "$CLUSTER_NAME" --config "$SCRIPT_DIR/meshobj-examples-events-cluster.yaml"

# Build events Docker image
echo "Building events Docker image..."
cd "$SCRIPT_DIR/../../.."
docker build -t meshobj/events:latest -f examples/events/generated/events/Dockerfile .

# Load image into kind
echo "Loading events image into kind..."
kind load docker-image meshobj/events:latest --name "$CLUSTER_NAME"

# Apply kustomize configuration for selected environment
echo "Applying kustomize configuration (overlay: $ENV)..."
kubectl apply -k "$SCRIPT_DIR/overlays/$ENV"

# Wait for namespace
echo "Waiting for namespace..."
kubectl wait --for=jsonpath='{.status.phase}'=Active namespace/"$NAMESPACE" --timeout=30s

# Wait for MongoDB and Redpanda in parallel (they're independent)
echo "Waiting for MongoDB and Redpanda (parallel)..."
kubectl wait --for=condition=ready pod -l app=mongodb -n "$NAMESPACE" --timeout=120s &
MONGO_PID=$!
kubectl wait --for=condition=ready pod -l app=redpanda -n "$NAMESPACE" --timeout=120s &
REDPANDA_PID=$!

# Wait for both to complete
wait $MONGO_PID || { echo "MongoDB failed to start"; exit 1; }
wait $REDPANDA_PID || { echo "Redpanda failed to start"; exit 1; }
echo "✓ MongoDB and Redpanda ready"

# Wait for Debezium to be ready
echo "Waiting for Debezium..."
kubectl wait --for=condition=available deployment/debezium -n "$NAMESPACE" --timeout=120s

# Wait for Events service to be ready
echo "Waiting for Events service..."
kubectl wait --for=condition=available deployment/events -n "$NAMESPACE" --timeout=300s

echo ""
echo "✓ Cluster setup complete!"
echo ""
echo "Cluster info:"
echo "  Name: $CLUSTER_NAME"
echo "  Namespace: $NAMESPACE"
echo "  Environment: $ENV"
if [[ "$ENV" == "ci" ]]; then
    echo "  Storage: emptyDir (ephemeral)"
else
    echo "  Storage: PersistentVolumeClaim"
fi
echo ""
echo "Services accessible at:"
echo "  MongoDB:  localhost:27017"
echo "  Kafka:    localhost:9092"
echo "  Events:   localhost:3033"
echo ""
echo "Useful commands:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl logs -n $NAMESPACE -l app=events"
echo "  kubectl delete cluster --name $CLUSTER_NAME"
