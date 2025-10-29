#!/usr/bin/env python3
"""
Fix port numbers in JMeter test plans for CQRS architecture.
- REST endpoints (/api) should use port 3034 (write service)
- GraphQL endpoints (/graph) should use port 3035 (read service)
"""

import re
import sys

def fix_ports(filename):
    with open(filename, 'r') as f:
        content = f.read()

    lines = content.split('\n')
    result = []

    for i, line in enumerate(lines):
        # If this line has a port definition
        if 'HTTPSampler.port">3033' in line or 'HTTPSampler.port">3034' in line or 'HTTPSampler.port">3035' in line:
            # Look ahead for the path to determine correct port
            path_found = False
            for j in range(i+1, min(i+10, len(lines))):
                if 'HTTPSampler.path' in lines[j]:
                    if '/api' in lines[j]:
                        # REST endpoint - use port 3034
                        line = re.sub(r'HTTPSampler.port">\d+', 'HTTPSampler.port">3034', line)
                    elif '/graph' in lines[j]:
                        # GraphQL endpoint - use port 3035
                        line = re.sub(r'HTTPSampler.port">\d+', 'HTTPSampler.port">3035', line)
                    path_found = True
                    break

            if not path_found:
                print(f"Warning: Found port at line {i+1} but no path within next 10 lines")

        result.append(line)

    with open(filename, 'w') as f:
        f.write('\n'.join(result))

    print(f"✓ Updated {filename}")

if __name__ == '__main__':
    import glob

    test_plans = glob.glob('test-plans/*.jmx')
    for plan in test_plans:
        fix_ports(plan)

    print("\nPort configuration updated:")
    print("  - REST endpoints (/api) → port 3034")
    print("  - GraphQL endpoints (/graph) → port 3035")
