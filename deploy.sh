#!/bin/bash
pnpm build
cd packages/up-provider
if [ -f "lukso-*.tgz" ]
then
  rm -f lukso-*.tgz
fi
pnpm pack
mv lukso-*.tgz ../..
cd ../..
find ../service-auth-simple -name "lukso-up-provider*.tgz" -exec rm {} \;
cp lukso-*.tgz ../service-auth-simple
find ../universalprofile-test-dapp -name "lukso-up-provider*.tgz" -exec rm {} \;
mv lukso-*.tgz ../universalprofile-test-dapp
