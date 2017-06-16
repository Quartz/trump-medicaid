library(dplyr)
library(readr)
library(readxl)
library(stringr)

election <- read_csv('data/2016_0_0_2.csv', skip = 1) %>%
  mutate(trump_pct = vote2 / totalvote * 100) %>%
  select(fips, name, trump_pct)

medicaid <- read_excel('data/State_County_All_Table.xlsx', sheet = 'State_county 2015', skip = 1) %>%
  select(
    fips = `State and County FIPS Code`,
    eligible = `Percent Eligible for Medicaid`
  ) %>%
  filter(
    !is.na(fips)
  ) %>%
  mutate(
    eligible = as.numeric(ifelse(eligible == '*', NA, str_sub(eligible, 1, -3)))
  )

merged <- election %>%
  left_join(medicaid)

write_csv(merged, 'src/data/data.csv')

quantile(merged$trump_pct, c(0.333, 0.666))
quantile(merged$eligible, c(0.333, 0.666), na.rm = TRUE)




