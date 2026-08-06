import prisma from '@/modules/db';
import { hashPassword } from '@/modules/auth';
import { TEST_OPTION, USER_ROLE } from '@/generated/prisma';

async function main() {
  const password = await hashPassword('password123');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@edutest.uz' },
    update: {},
    create: {
      fullName: 'Administrator',
      email: 'admin@edutest.uz',
      password,
      role: USER_ROLE.ADMIN,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'malika@edutest.uz' },
    update: {},
    create: {
      fullName: 'Malika Abduvaliyeva',
      email: 'malika@edutest.uz',
      password,
      role: USER_ROLE.TEACHER,
      subject: 'Matematika',
      school_name: "32-sonli umumta'lim maktabi",
      region: 'Toshkent viloyati',
      district: 'Qibray tumani',
      phone: '+998901234567',
    },
  });

  const subjectNames = ['Matematika', 'Fizika', 'Ingliz tili', 'Kimyo', 'Biologiya'];
  for (const name of subjectNames) {
    await prisma.subject.upsert({ where: { name }, update: {}, create: { name } });
  }

  if ((await prisma.tests.count()) > 0) {
    console.info('Seed: users are up to date, demo tests already exist.');
    return;
  }

  const tests = [
    {
      name: 'Matematika test 1',
      subject: 'Matematika',
      description: 'Chiziqli tenglamalar va asosiy amallar bo\'yicha test',
      duration_minutes: 30,
      questions: [
        { text: 'Quyidagi tenglamani yeching: 2x + 5 = 15', option_a: 'x = 5', option_b: 'x = 7', option_c: 'x = 10', option_d: 'x = 15', correct_option: TEST_OPTION.A },
        { text: '7 x 8 = ?', option_a: '54', option_b: '56', option_c: '58', option_d: '64', correct_option: TEST_OPTION.B },
        { text: 'Uchburchakning ichki burchaklari yig\'indisi nechchi gradus?', option_a: '90', option_b: '180', option_c: '270', option_d: '360', correct_option: TEST_OPTION.B },
        { text: '15 ning 20% qancha bo\'ladi?', option_a: '2', option_b: '3', option_c: '4', option_d: '5', correct_option: TEST_OPTION.B },
        { text: 'x^2 = 49 bo\'lsa, x ning musbat qiymati nechaga teng?', option_a: '6', option_b: '7', option_c: '8', option_d: '9', correct_option: TEST_OPTION.B },
      ],
    },
    {
      name: 'Fizika test 2',
      subject: 'Fizika',
      description: "Harakat va kuch mavzulari bo'yicha test",
      duration_minutes: 35,
      questions: [
        { text: 'Tezlik birligi SI tizimida qanday ifodalanadi?', option_a: 'kg', option_b: 'm/s', option_c: 'N', option_d: 'J', correct_option: TEST_OPTION.B },
        { text: 'Nyutonning ikkinchi qonuni formulasi qaysi?', option_a: 'F = m/a', option_b: 'F = ma', option_c: 'F = m+a', option_d: 'F = a/m', correct_option: TEST_OPTION.B },
        { text: 'Erkin tushish tezlanishi taxminan nechaga teng?', option_a: '8.9 m/s^2', option_b: '9.8 m/s^2', option_c: '10.8 m/s^2', option_d: '11.2 m/s^2', correct_option: TEST_OPTION.B },
        { text: 'Energiya birligi qaysi?', option_a: 'Vatt', option_b: 'Nyuton', option_c: 'Joul', option_d: 'Amper', correct_option: TEST_OPTION.C },
      ],
    },
    {
      name: 'Ingliz tili test 1',
      subject: 'Ingliz tili',
      description: 'Grammatika va lug\'at boyligi bo\'yicha test',
      duration_minutes: 45,
      questions: [
        { text: 'She ___ to school every day.', option_a: 'go', option_b: 'goes', option_c: 'going', option_d: 'gone', correct_option: TEST_OPTION.B },
        { text: 'Choose the correct synonym for "happy".', option_a: 'sad', option_b: 'angry', option_c: 'joyful', option_d: 'tired', correct_option: TEST_OPTION.C },
        { text: 'What is the past tense of "go"?', option_a: 'goed', option_b: 'went', option_c: 'gone', option_d: 'going', correct_option: TEST_OPTION.B },
      ],
    },
    {
      name: 'Kimyo test 1',
      subject: 'Kimyo',
      description: "Davriy sistema va asosiy tushunchalar bo'yicha test",
      duration_minutes: 30,
      questions: [
        { text: 'Suvning kimyoviy formulasi qanday?', option_a: 'CO2', option_b: 'H2O', option_c: 'O2', option_d: 'NaCl', correct_option: TEST_OPTION.B },
        { text: 'Davriy sistemadagi birinchi element qaysi?', option_a: 'Kislorod', option_b: 'Vodorod', option_c: 'Geliy', option_d: 'Uglerod', correct_option: TEST_OPTION.B },
        { text: 'Osh tuzining kimyoviy formulasi qanday?', option_a: 'NaCl', option_b: 'KCl', option_c: 'CaCl2', option_d: 'NaOH', correct_option: TEST_OPTION.A },
      ],
    },
    {
      name: 'Biologiya test 1',
      subject: 'Biologiya',
      description: "Hujayra va tirik organizmlar bo'yicha test",
      duration_minutes: 35,
      questions: [
        { text: 'Hujayraning energiya stansiyasi deb nima ataladi?', option_a: 'Yadro', option_b: 'Mitoxondriya', option_c: 'Ribosoma', option_d: 'Golji apparati', correct_option: TEST_OPTION.B },
        { text: 'Fotosintez qaysi organellada sodir bo\'ladi?', option_a: 'Xloroplast', option_b: 'Mitoxondriya', option_c: 'Yadro', option_d: 'Vakuola', correct_option: TEST_OPTION.A },
        { text: 'Inson tanasida nechta xromosoma bor?', option_a: '23', option_b: '44', option_c: '46', option_d: '48', correct_option: TEST_OPTION.C },
      ],
    },
  ];

  for (const test of tests) {
    await prisma.tests.create({
      data: {
        name: test.name,
        subject: test.subject,
        description: test.description,
        duration_minutes: test.duration_minutes,
        questions: {
          create: test.questions.map((question, index) => ({ ...question, order: index })),
        },
      },
    });
  }

  // A couple of finished attempts so the demo teacher's dashboard isn't empty on first login.
  const mathTest = await prisma.tests.findFirst({ where: { name: 'Matematika test 1' }, include: { questions: true } });
  const physicsTest = await prisma.tests.findFirst({ where: { name: 'Fizika test 2' }, include: { questions: true } });

  if (mathTest) {
    const correctCount = mathTest.questions.length - 1;
    await prisma.testAttempts.create({
      data: {
        user_id: teacher.id,
        test_id: mathTest.id,
        total_questions: mathTest.questions.length,
        correct_count: correctCount,
        incorrect_count: mathTest.questions.length - correctCount,
        score: correctCount,
        percent: Math.round((correctCount / mathTest.questions.length) * 10000) / 100,
        duration_seconds: 1240,
        answers: {
          create: mathTest.questions.map((question: any, index: number) => {
            const isCorrect = index !== 0;
            return {
              question_id: question.id,
              selected_option: isCorrect ? question.correct_option : TEST_OPTION.A,
              is_correct: isCorrect,
            };
          }),
        },
      },
    });
  }

  if (physicsTest) {
    const correctCount = physicsTest.questions.length;
    await prisma.testAttempts.create({
      data: {
        user_id: teacher.id,
        test_id: physicsTest.id,
        total_questions: physicsTest.questions.length,
        correct_count: correctCount,
        incorrect_count: 0,
        score: correctCount,
        percent: 100,
        duration_seconds: 1580,
        answers: {
          create: physicsTest.questions.map((question: any) => ({
            question_id: question.id,
            selected_option: question.correct_option,
            is_correct: true,
          })),
        },
      },
    });
  }

  console.info('Seed completed.');
  console.info(`Admin login:   admin@edutest.uz / password123`);
  console.info(`Teacher login: malika@edutest.uz / password123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
