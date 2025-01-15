pot:
	./scripts/update-pot.sh

build:
	./scripts/build.sh

install:
	./scripts/build.sh -i

try:
	./scripts/build.sh -i
	./scripts/launch_gnome_nested.sh
