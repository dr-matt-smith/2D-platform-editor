

- [] add in some human player heuristics?
  - e.g. move towards nearest horizontal pickup, jump only if necessary
  - if there is something blocking, try jumping
    - (1) if the target pickup is above current height, then try jumping the gap
  - if there is a gap
    - (1) if the target pickup is at / above current height, then try jumping the gap
    - (2) if no path found, then try dropping down gap and then continue
