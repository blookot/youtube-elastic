#!/bin/bash

cat topartists.txt | \
while read CMD; do
    node myapp.js $CMD
done
