# Деплой Med Reminder Bot на AWS EC2

Эта инструкция поможет вам развернуть бот на AWS, чтобы он работал 24/7.

## Предварительные шаги

1. У вас должен быть аккаунт на AWS
2. Создайте SSH Key Pair в AWS Console (EC2 → Key Pairs → Create key pair)
3. Сохраните проект на GitHub/GitLab (или любой другой Git хостинг)
4. Заполните локальный файл `.env` нужными ключами (скопируйте из `.env.example`)

## Шаг 1: Запустите инстанс через CloudFormation (самый простой способ)

1. Перейдите в [AWS CloudFormation Console: https://console.aws.amazon.com/cloudformation/
2. Нажмите **Create stack** → **With new resources (standard)**
3. Выберите **Template is ready** → **Upload a template file**
4. Загрузите файл `aws-cloudformation-template.yml из этого проекта
5. Нажмите **Next**
6. Заполните параметры:
   - **Stack name**: `med-reminder-bot-stack
   - **KeyName**: выберите вашу SSH Key Pair
   - **InstanceType**: оставьте `t2.micro` (бесплатный тариф)
   - **SSHLocation**: оставьте `0.0.0.0/0` (или укажите ваш IP для безопасности)
7. Нажмите **Next** → **Next** → **Submit**
8. Дождитесь, пока стек создастся (статус станет `CREATE_COMPLETE`)

## Шаг 2: Подготовьте проект к деплою

1. Перейдите в EC2 Console и найдите ваш новый инстанс
2. Скопируйте **Public DNS** инстанса
3. Убедитесь, что ваш локальный `.env` файл заполнен нужными ключами

## Шаг 3: Запустите деплой скрипт

Откройте терминал в папке проекта и запустите:

```bash
./deploy-ec2.sh <ec2-public-dns> <путь-к-ключ.pem> <ссылка-на-git-репозиторий>
```

Пример:
```bash
./deploy-ec2.sh ec2-12-34-56-78.us-east-1.compute.amazonaws.com ~/.ssh/my-aws-key.pem https://github.com/ваш-юзернейм/med-reminder-bot.git
```

## Шаг 4: Проверка

Подключитесь к инстансу по SSH, чтобы проверить статус:
```bash
ssh -i "ваш-ключ.pem ubuntu@<ec2-public-dns>
pm2 status  # Посмотреть статус процессов
pm2 logs  # Посмотреть логи
pm2 logs medbot-server  # Логи бота
pm2 logs medbot-worker  # Логи воркера
```

## Что делать дальше

- Для обновления бота просто запустите скрипт `deploy-ec2.sh` снова — он обновит код и перезапустит процессы.
