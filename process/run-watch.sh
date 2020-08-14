while true
do
  make run
  inotifywait -qq -r -e create,close_write,modify,move,delete ./
done
