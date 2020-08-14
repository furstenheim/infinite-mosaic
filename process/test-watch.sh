while true
do
  make test
  inotifywait -qq -r -e create,close_write,modify,move,delete ./
done
