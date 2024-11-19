# SCRMBLD

A simple daily word game of finding the the 7 letter word from 8 scrambled letters.

## To run locally

Install dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## TODO: Calculate percentiles for a user's finish time

Add every user's 'finish' time in a database table

Every X minutes, re-caculate a histogram table for each day's word.

The histogram table should look something like this:

```
day          | percentile | min  | max    | count
--------------------------------------------------
123412341234 | 1          | 1000 | 100000 | 0
123412341234 | 2          | 500  | 1000   | 2
123412341234 | 3          | 100  | 500    | 5
...
123412341234 | 100        | 0    | 20     | 1
```

The `day` column shows the epoch timestamp in UTC of the days word that was played
The `percentile` shows the 1-100 percentile 'score' based on the finish time
The `min` in the minimum time in ms the user must get to be in this percentile
The `max` in the maximum time in ms the user must get to be in this percentile
The `count` is the number of user times that fall into this percentile

To generate this table, use the 'finish' time table to retrieve all the scores/times for all users for that day's word

Order the table by finish time.

Loop through every "finish time" entry.

Calculate the percentile of each entry by counting the number of values below this entry (simply use the index) and divide by the total number of entries. Multiply by 100.

Take this percentile and increase the count in the histogram table for that percentile.

Adjust the min/max times for each percentile based on each entry that falls in that percentile.

For example if an entry is in the 1st percentile and has a time of 10s, the min/max should be adjusted to ensure 10s fits in that range.

Then whenever a different user finishes the game, the server can simply compare their time to the min/max of the histogram table to get the user's percentile
