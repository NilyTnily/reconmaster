import { faker } from '@faker-js/faker'

export function generateFieldValue(label: string, type: string): string {
  const l = label.toLowerCase()

  // Name fields
  if (l.includes('first') || l === 'fname' || l === 'given') return faker.person.firstName()
  if (l.includes('last') || l === 'lname' || l === 'surname' || l === 'family') return faker.person.lastName()
  if (l === 'name' || l.includes('full name') || l.includes('your name')) return faker.person.fullName()
  if (l.includes('display') && l.includes('name')) return faker.internet.username()
  if (l.includes('username') || l === 'user') return faker.internet.username().toLowerCase()

  // Contact
  if (l.includes('email') || l.includes('e-mail')) return faker.internet.email()
  if (l.includes('phone') || l.includes('mobile') || l.includes('tel') || type === 'tel') return faker.phone.number()

  // Auth
  if (l.includes('password') || l.includes('passwd') || l === 'pass') return faker.internet.password({ length: 14, memorable: false })
  if (l.includes('confirm') && l.includes('pass')) return 'Password@123'

  // Address
  if (l === 'address' || l.includes('street') || l.includes('addr')) return faker.location.streetAddress()
  if (l.includes('city') || l.includes('town')) return faker.location.city()
  if (l.includes('state') || l.includes('province') || l.includes('region')) return faker.location.state({ abbreviated: true })
  if (l.includes('zip') || l.includes('postal') || l.includes('postcode')) return faker.location.zipCode()
  if (l.includes('country')) return faker.location.country()

  // Business
  if (l.includes('company') || l.includes('organisation') || l.includes('organization') || l.includes('employer')) return faker.company.name()
  if (l.includes('title') || l.includes('position') || l.includes('job')) return faker.person.jobTitle()
  if (l.includes('website') || l.includes('url') || l.includes('homepage')) return `https://www.${faker.internet.domainName()}`

  // Financial (realistic-format only)
  if (l.includes('card') && l.includes('number')) return '4111111111111111'
  if (l.includes('cvv') || l.includes('cvc') || l.includes('csc')) return '737'
  if (l.includes('expir')) return '12/28'

  // Dates
  if (type === 'date' || l.includes('birthday') || l.includes('birth date') || l.includes('dob'))
    return faker.date.birthdate({ min: 25, max: 45, mode: 'age' }).toISOString().split('T')[0]
  if (type === 'month') return `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  // Numbers
  if (type === 'number' || l.includes('quantity') || l.includes('amount') || l.includes('qty'))
    return String(faker.number.int({ min: 1, max: 99 }))
  if (l.includes('age')) return String(faker.number.int({ min: 22, max: 45 }))

  // Text / textarea
  if (type === 'textarea' || l.includes('message') || l.includes('comment') || l.includes('note') || l.includes('description'))
    return faker.lorem.sentences(2)
  if (l.includes('bio') || l.includes('about')) return faker.lorem.sentence()

  // Search / query (keep blank — don't want to pollute search)
  if (l.includes('search') || l.includes('query') || l.includes('keyword')) return ''

  // Generic fallback by type
  if (type === 'email') return faker.internet.email()
  if (type === 'password') return faker.internet.password({ length: 14 })
  if (type === 'url') return `https://${faker.internet.domainName()}`
  if (type === 'number') return String(faker.number.int({ min: 1, max: 100 }))

  return faker.lorem.word()
}
