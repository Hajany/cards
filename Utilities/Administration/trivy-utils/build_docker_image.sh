#!/bin/bash

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

PACKAGE_CONFIGURATION_DIRECTORY=$1
EXPORT_TAR_PATH=$2

mkdir _docker-build
echo "FROM scratch" > _docker-build/Dockerfile

cp -v $PACKAGE_CONFIGURATION_DIRECTORY/vm/os-release _docker-build/
echo "COPY os-release /etc/os-release" >> _docker-build/Dockerfile

cp -v $PACKAGE_CONFIGURATION_DIRECTORY/vm/status _docker-build/
echo "COPY status /var/lib/dpkg/status" >> _docker-build/Dockerfile

if [ -f $PACKAGE_CONFIGURATION_DIRECTORY/vm/debian_version ]
then
  cp -v $PACKAGE_CONFIGURATION_DIRECTORY/vm/debian_version _docker-build/
  echo "COPY debian_version /etc/debian_version" >> _docker-build/Dockerfile
fi

if [ -f $PACKAGE_CONFIGURATION_DIRECTORY/vm/lsb-release ]
then
  cp -v $PACKAGE_CONFIGURATION_DIRECTORY/vm/lsb-release _docker-build/
  echo "COPY lsb-release /etc/lsb-release" >> _docker-build/Dockerfile
fi

DOCKER_IMAGE_TAG=$(cat /proc/sys/kernel/random/uuid)
cd _docker-build
docker build -t $DOCKER_IMAGE_TAG .
cd ..
docker save $DOCKER_IMAGE_TAG --output $EXPORT_TAR_PATH
docker rmi $DOCKER_IMAGE_TAG
rm -rf _docker-build
