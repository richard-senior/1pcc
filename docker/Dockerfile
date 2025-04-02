FROM alpine:latest AS bccquiz

#WORKDIR /opt

ARG GITHUB_TOKEN
ENV GITHUB_TOKEN=$GITHUB_TOKEN
ARG DATA_DIR
ENV DATA_DIR=$DATA_DIR
# Override the entrypoint from the parent image
ENTRYPOINT ["/bin/bash"]

COPY . /opt/1pcc

RUN apt-get update -y &&\