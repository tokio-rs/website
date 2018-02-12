set -e -x

# Sync the website
aws s3 sync $TRAVIS_BUILD_DIR/public s3://tokio.rs --acl public-read --delete

# Create a cloudfront invalidation
echo -n '{"Paths": {"Items": ["/*"], "Quantity": 1}, "CallerReference":"' >> payload.json &&
echo -n "travis-$(date)" >> payload.json &&
echo -n '"}' >> payload.json

# Submit the invalidation
~/.local/bin/aws cloudfront create-invalidation --invalidation-batch file://payload.json --distribution-id ELMMDTQCB9BNA
